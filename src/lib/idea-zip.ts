import { toCsv } from "./csv";
import { createZipStream, type ZipEntry } from "./zip";

/** One document as listed by GET /api/v1/admin/export/ideas. */
export type IdeaDocItem = {
  fileId: string;
  registrationId: string;
  teamName: string;
  status: string;
  reviewScore: number | null;
  title: string;
  ext: string;
  originalName: string | null;
  sizeBytes: number;
  createdAt: number;
};

/** Keeps letters (Bangla included), digits, "-" and "_" so names are safe on every OS. */
export function safeFilePart(s: string, max = 60): string {
  const clean = s
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N}_-]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, max);
  return clean || "team";
}

export function ideaZipName(item: Pick<IdeaDocItem, "registrationId" | "teamName" | "ext">): string {
  const ext = item.ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  return `ideas/${safeFilePart(item.registrationId, 20)}_${safeFilePart(item.teamName)}.${ext}`;
}

/**
 * Builds the ZIP: every document under ideas/, then index.csv, which marks documents
 * that could not be fetched as MISSING. `fetchFile` returns null for a missing file.
 * Up to `concurrency` downloads run ahead of the one being written.
 */
export function buildIdeaZip(
  items: IdeaDocItem[],
  fetchFile: (item: IdeaDocItem) => Promise<Uint8Array | null>,
  opts: { concurrency?: number; onProgress?: (done: number, total: number) => void; now?: Date } = {},
): ReadableStream<Uint8Array> {
  const concurrency = Math.max(1, opts.concurrency ?? 4);
  const found = new Array<boolean>(items.length).fill(false);
  const pending = new Map<number, Promise<Uint8Array | null>>();
  let next = 0;
  let done = 0;
  const startUpTo = (limit: number) => {
    while (next < items.length && next < limit) {
      const i = next++;
      const p = fetchFile(items[i]);
      p.catch(() => {}); // surfaced when this entry is written; avoids an unhandled rejection meanwhile
      pending.set(i, p);
    }
  };

  async function* entries(): AsyncGenerator<ZipEntry> {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      yield {
        name: ideaZipName(item),
        date: new Date(item.createdAt),
        open: async () => {
          startUpTo(i + concurrency);
          const bytes = await pending.get(i)!;
          pending.delete(i);
          found[i] = bytes !== null;
          opts.onProgress?.(++done, items.length);
          return bytes;
        },
      };
    }
    yield {
      name: "index.csv",
      date: opts.now ?? new Date(),
      open: async () =>
        new TextEncoder().encode(
          toCsv(
            ["Registration ID", "Team", "Status", "Review score", "Idea title", "File in ZIP", "Original filename", "Size (bytes)"],
            items.map((it, i) => [it.registrationId, it.teamName, it.status, it.reviewScore, it.title, found[i] ? ideaZipName(it) : "MISSING", it.originalName, it.sizeBytes]),
          ),
        ),
    };
  }

  return createZipStream(entries());
}
