import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { buildIdeaZip, ideaZipName, safeFilePart, type IdeaDocItem } from "@/lib/idea-zip";
import { crc32, createZipStream, type ZipEntry } from "@/lib/zip";

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    parts.push(value);
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Reads names and bytes back through the central directory, checking each CRC. */
function readZip(zip: Uint8Array): Map<string, Uint8Array> {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const eocd = zip.length - 22;
  expect(v.getUint32(eocd, true)).toBe(0x06054b50);
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out = new Map<string, Uint8Array>();
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(p, true)).toBe(0x02014b50);
    expect(v.getUint16(p + 8, true) & 0x0800).toBe(0x0800);
    const crc = v.getUint32(p + 16, true);
    const size = v.getUint32(p + 24, true);
    const nameLen = v.getUint16(p + 28, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(zip.subarray(p + 46, p + 46 + nameLen));
    expect(v.getUint32(local, true)).toBe(0x04034b50);
    const dataStart = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const data = zip.subarray(dataStart, dataStart + size);
    expect(crc32(data)).toBe(crc);
    expect(v.getUint32(dataStart + size, true)).toBe(0x08074b50);
    out.set(name, data);
    p += 46 + nameLen;
  }
  return out;
}

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
}

describe("zip writer", () => {
  test("crc32 matches the standard check value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
    // Continuing across chunks gives the same result as one pass.
    const enc = new TextEncoder();
    expect(crc32(enc.encode("6789"), crc32(enc.encode("12345")))).toBe(0xcbf43926);
  });

  test("round-trips streamed and in-memory entries, keeps UTF-8 names and skips missing ones", async () => {
    const entries: ZipEntry[] = [
      { name: "ideas/COU26-AAA111_আমার_দোকান.pdf", open: async () => streamOf("%PDF-1.7 ", "hello ", "world") },
      { name: "ideas/COU26-BBB222_missing.pdf", open: async () => null },
      { name: "index.csv", open: async () => new TextEncoder().encode("a,b\r\n1,2\r\n") },
    ];
    const zip = await collect(createZipStream(entries));
    const files = readZip(zip);
    const dec = new TextDecoder();
    expect([...files.keys()]).toEqual(["ideas/COU26-AAA111_আমার_দোকান.pdf", "index.csv"]);
    expect(dec.decode(files.get("ideas/COU26-AAA111_আমার_দোকান.pdf"))).toBe("%PDF-1.7 hello world");
    expect(dec.decode(files.get("index.csv"))).toBe("a,b\r\n1,2\r\n");

    // Cross-check with the system unzip when it is installed.
    let hasUnzip = true;
    try {
      execFileSync("unzip", ["-v"], { stdio: "ignore" });
    } catch {
      hasUnzip = false;
    }
    if (hasUnzip) {
      const path = join(mkdtempSync(join(tmpdir(), "zip-test-")), "t.zip");
      writeFileSync(path, zip);
      expect(execFileSync("unzip", ["-t", path]).toString()).toMatch(/No errors detected/);
    }
  });

  test("rejects duplicate entry names", async () => {
    const entry = { name: "a.txt", open: async () => new Uint8Array([1]) };
    await expect(collect(createZipStream([entry, entry]))).rejects.toThrow(/Duplicate/);
  });

  test("idea ZIP: safe names, documents in order, index.csv marks missing files", async () => {
    const base = { status: "SUBMITTED", reviewScore: null, originalName: "x.pdf", sizeBytes: 3, createdAt: Date.UTC(2026, 10, 15) };
    const items: IdeaDocItem[] = [
      { ...base, fileId: "f1", registrationId: "COU26-AAA111", teamName: "Bro _Code", title: "Amar Dokan", ext: "pdf" },
      { ...base, fileId: "f2", registrationId: "COU26-BBB222", teamName: "Gone/../team", title: "Lost", ext: "docx" },
      { ...base, fileId: "f3", registrationId: "COU26-CCC333", teamName: "আমার দল!", title: "Bangla", ext: "PDF" },
    ];
    expect(ideaZipName(items[1])).toBe("ideas/COU26-BBB222_Gone_team.docx");
    expect(safeFilePart("***")).toBe("team");

    let inFlight = 0;
    let maxInFlight = 0;
    const progress: number[] = [];
    const zip = await collect(
      buildIdeaZip(
        items,
        async (it) => {
          inFlight++;
          maxInFlight = Math.max(maxInFlight, inFlight);
          await new Promise((r) => setTimeout(r, 5));
          inFlight--;
          return it.fileId === "f2" ? null : new TextEncoder().encode(it.fileId);
        },
        { concurrency: 2, onProgress: (d) => progress.push(d) },
      ),
    );
    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(progress).toEqual([1, 2, 3]);
    const files = readZip(zip);
    expect([...files.keys()]).toEqual(["ideas/COU26-AAA111_Bro_Code.pdf", "ideas/COU26-CCC333_আমার_দল.pdf", "index.csv"]);
    const index = new TextDecoder().decode(files.get("index.csv"));
    expect(index).toContain('"COU26-BBB222","Gone/../team","SUBMITTED","","Lost","MISSING"');
    expect(index).toContain('"ideas/COU26-AAA111_Bro_Code.pdf"');
  });

  test("idea ZIP: a failed download aborts the archive", async () => {
    const item: IdeaDocItem = { fileId: "f", registrationId: "COU26-X", teamName: "t", status: "SUBMITTED", reviewScore: null, title: "t", ext: "pdf", originalName: null, sizeBytes: 1, createdAt: 0 };
    await expect(collect(buildIdeaZip([item], async () => Promise.reject(new Error("network down"))))).rejects.toThrow("network down");
  });

  test("an empty archive is still valid", async () => {
    const zip = await collect(createZipStream([]));
    expect(zip.length).toBe(22);
    expect(readZip(zip).size).toBe(0);
  });
});
