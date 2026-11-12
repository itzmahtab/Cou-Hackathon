import { and, eq, inArray, lt } from "drizzle-orm";
import type { Ctx } from "../ctx";
import { files, FILE_CATEGORIES } from "../db/schema";
import { AppError } from "../http";
import { sha256Hex, uuid } from "../ids";

export type FileCategory = (typeof FILE_CATEGORIES)[number];
export type Sniffed = { ext: string; contentType: string; kind: "image" | "document" };

const MB = 1024 * 1024;

export const FILE_RULES: Record<FileCategory, { maxBytes: number; kinds: Sniffed["kind"][]; folder: string; label: string }> = {
  STUDENT_ID: { maxBytes: 3 * MB, kinds: ["image"], folder: "student-id", label: "JPG, PNG or WebP, up to 3 MB" },
  IDEA_DOC: { maxBytes: 10 * MB, kinds: ["document"], folder: "ideas", label: "PDF or DOCX, up to 10 MB" },
  PAYMENT_SCREENSHOT: { maxBytes: 3 * MB, kinds: ["image"], folder: "payments", label: "JPG, PNG or WebP, up to 3 MB" },
};

const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

function startsWith(buf: Uint8Array, sig: number[] | Uint8Array, offset = 0) {
  if (buf.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) if (buf[offset + i] !== sig[i]) return false;
  return true;
}

function contains(buf: Uint8Array, needle: Uint8Array) {
  outer: for (let i = 0; i <= buf.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (buf[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

/** Identifies a file from its bytes. The client's filename and MIME type are never trusted. */
export function sniffFile(buf: Uint8Array): Sniffed | null {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { ext: "jpg", contentType: "image/jpeg", kind: "image" };
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: "png", contentType: "image/png", kind: "image" };
  if (startsWith(buf, ascii("RIFF")) && startsWith(buf, ascii("WEBP"), 8)) return { ext: "webp", contentType: "image/webp", kind: "image" };
  if (startsWith(buf, ascii("%PDF-"))) return { ext: "pdf", contentType: "application/pdf", kind: "document" };
  // DOCX is a ZIP whose directory names word/document.xml and [Content_Types].xml.
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04]) && contains(buf, ascii("[Content_Types].xml")) && contains(buf, ascii("word/document.xml"))) {
    return { ext: "docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kind: "document" };
  }
  return null;
}

export function sanitiseName(name: string | undefined | null): string | null {
  if (!name) return null;
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[^\w.\- ()]/g, "_").replace(/\.{2,}/g, ".").trim().slice(0, 120);
  return clean || null;
}

export async function storeUpload(
  ctx: Ctx,
  input: { category: FileCategory; bytes: Uint8Array; originalName?: string | null; uploadSession: string },
) {
  const rule = FILE_RULES[input.category];
  if (!rule) throw new AppError(400, "VALIDATION_ERROR", "Unknown file category.");
  if (input.bytes.length === 0) throw new AppError(400, "VALIDATION_ERROR", "The file is empty.");
  if (input.bytes.length > rule.maxBytes) throw new AppError(413, "FILE_TOO_LARGE", `The file is too large. Allowed: ${rule.label}.`);
  const sniffed = sniffFile(input.bytes);
  if (!sniffed || !rule.kinds.includes(sniffed.kind)) {
    throw new AppError(415, "UNSUPPORTED_FILE_TYPE", `That file type is not accepted. Allowed: ${rule.label}.`);
  }
  const id = uuid();
  const r2Key = `${rule.folder}/${id}.${sniffed.ext}`;
  await ctx.files.put(r2Key, input.bytes as never, { httpMetadata: { contentType: sniffed.contentType } });
  await ctx.db.insert(files).values({
    id,
    category: input.category,
    r2Key,
    contentType: sniffed.contentType,
    sizeBytes: input.bytes.length,
    sha256: await sha256Hex(input.bytes),
    originalName: sanitiseName(input.originalName),
    status: "PENDING",
    uploadSession: input.uploadSession,
    createdAt: ctx.now(),
  });
  return { fileId: id, sizeBytes: input.bytes.length, contentType: sniffed.contentType };
}

/** Deletes uploads that were never attached to a registration or payment. */
export async function cleanupOrphanUploads(ctx: Ctx, olderThanMs = 24 * 60 * 60 * 1000): Promise<number> {
  const stale = await ctx.db
    .select({ id: files.id, r2Key: files.r2Key })
    .from(files)
    .where(and(eq(files.status, "PENDING"), lt(files.createdAt, ctx.now() - olderThanMs)))
    .limit(200);
  if (stale.length === 0) return 0;
  await ctx.files.delete(stale.map((f) => f.r2Key));
  for (let i = 0; i < stale.length; i += 50) {
    await ctx.db.delete(files).where(inArray(files.id, stale.slice(i, i + 50).map((f) => f.id)));
  }
  return stale.length;
}
