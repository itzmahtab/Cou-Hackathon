/**
 * Minimal streaming ZIP writer (store method, no compression).
 *
 * Idea documents are PDFs and DOCX files, which are already compressed, so storing
 * them as-is keeps CPU time low on Workers. Entries are written one after another
 * with a data descriptor, so each file is streamed straight from R2 and never held
 * in memory as a whole. File names are flagged as UTF-8, so Bangla names survive.
 * No ZIP64: archives and entries are limited to 4 GiB and 65,535 entries.
 */

export type ZipSource = Uint8Array | ReadableStream<Uint8Array>;

export interface ZipEntry {
  /** Path inside the archive, e.g. "ideas/COU26-ABC123_team.pdf". */
  name: string;
  /** Returns the file body, or null to leave the entry out of the archive. */
  open: () => Promise<ZipSource | null>;
  date?: Date;
}

const MAX_U32 = 0xffffffff;
const MAX_ENTRIES = 0xffff;
const FLAGS = 0x0008 | 0x0800; // sizes in data descriptor | UTF-8 names
const VERSION = 20;

let crcTable: Uint32Array | null = null;
function table(): Uint32Array {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}

/** Continues a CRC-32 over `data`. Start with 0; the result is the finished checksum. */
export function crc32(data: Uint8Array, crc = 0): number {
  const t = table();
  let c = ~crc >>> 0;
  for (let i = 0; i < data.length; i++) c = t[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(d.getUTCFullYear(), 1980);
  return {
    time: (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | Math.floor(d.getUTCSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate(),
  };
}

function localHeader(name: Uint8Array, time: number, date: number): Uint8Array {
  const b = new Uint8Array(30 + name.length);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x04034b50, true);
  v.setUint16(4, VERSION, true);
  v.setUint16(6, FLAGS, true);
  v.setUint16(8, 0, true); // stored
  v.setUint16(10, time, true);
  v.setUint16(12, date, true);
  // CRC and sizes are zero here and follow in the data descriptor.
  v.setUint16(26, name.length, true);
  b.set(name, 30);
  return b;
}

function dataDescriptor(crc: number, size: number): Uint8Array {
  const b = new Uint8Array(16);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x08074b50, true);
  v.setUint32(4, crc, true);
  v.setUint32(8, size, true);
  v.setUint32(12, size, true);
  return b;
}

interface Written {
  name: Uint8Array;
  time: number;
  date: number;
  crc: number;
  size: number;
  offset: number;
}

function centralHeader(e: Written): Uint8Array {
  const b = new Uint8Array(46 + e.name.length);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x02014b50, true);
  v.setUint16(4, VERSION, true);
  v.setUint16(6, VERSION, true);
  v.setUint16(8, FLAGS, true);
  v.setUint16(10, 0, true);
  v.setUint16(12, e.time, true);
  v.setUint16(14, e.date, true);
  v.setUint32(16, e.crc, true);
  v.setUint32(20, e.size, true);
  v.setUint32(24, e.size, true);
  v.setUint16(28, e.name.length, true);
  v.setUint32(42, e.offset, true);
  b.set(e.name, 46);
  return b;
}

function endOfCentralDirectory(count: number, size: number, offset: number): Uint8Array {
  const b = new Uint8Array(22);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(8, count, true);
  v.setUint16(10, count, true);
  v.setUint32(12, size, true);
  v.setUint32(16, offset, true);
  return b;
}

function tooBig(): Error {
  return new Error("ZIP archive would exceed 4 GiB; ZIP64 is not supported.");
}

async function* chunksOf(source: ZipSource): AsyncGenerator<Uint8Array> {
  if (source instanceof Uint8Array) {
    yield source;
    return;
  }
  const reader = source.getReader();
  let finished = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        finished = true;
        return;
      }
      if (value?.length) yield value;
    }
  } finally {
    // Stopped early (download cancelled or error): release the underlying R2 body.
    if (!finished) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function* zipChunks(entries: Iterable<ZipEntry> | AsyncIterable<ZipEntry>): AsyncGenerator<Uint8Array> {
  const enc = new TextEncoder();
  const written: Written[] = [];
  const seen = new Set<string>();
  let offset = 0;

  for await (const entry of entries) {
    if (seen.has(entry.name)) throw new Error(`Duplicate ZIP entry name: ${entry.name}`);
    const source = await entry.open();
    if (source === null) continue;
    if (written.length >= MAX_ENTRIES) throw new Error("Too many ZIP entries; ZIP64 is not supported.");
    seen.add(entry.name);

    const name = enc.encode(entry.name);
    const { time, date } = dosDateTime(entry.date ?? new Date());
    const header = localHeader(name, time, date);
    const start = offset;
    yield header;
    offset += header.length;

    let crc = 0;
    let size = 0;
    for await (const chunk of chunksOf(source)) {
      crc = crc32(chunk, crc);
      size += chunk.length;
      if (size > MAX_U32) throw tooBig();
      yield chunk;
    }
    offset += size;
    const descriptor = dataDescriptor(crc, size);
    yield descriptor;
    offset += descriptor.length;
    if (offset > MAX_U32) throw tooBig();
    written.push({ name, time, date, crc, size, offset: start });
  }

  const cdStart = offset;
  for (const e of written) {
    const h = centralHeader(e);
    yield h;
    offset += h.length;
  }
  if (offset > MAX_U32) throw tooBig();
  yield endOfCentralDirectory(written.length, offset - cdStart, cdStart);
}

/** Streams a ZIP archive of `entries`, pulling (and opening) each entry only when the reader is ready. */
export function createZipStream(entries: Iterable<ZipEntry> | AsyncIterable<ZipEntry>): ReadableStream<Uint8Array> {
  const it = zipChunks(entries);
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await it.next();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (err) {
        controller.error(err);
      }
    },
    async cancel() {
      await it.return(undefined);
    },
  });
}
