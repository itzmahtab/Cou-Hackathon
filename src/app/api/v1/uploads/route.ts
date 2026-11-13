import { getCtx } from "@/lib/ctx";
import { FILE_CATEGORIES } from "@/lib/db/schema";
import { AppError, assertSameOrigin, clientIp, handle, jsonOk } from "@/lib/http";
import { FILE_RULES, storeUpload, type FileCategory } from "@/lib/r2/files";
import { rateLimit } from "@/lib/security/ratelimit";
import { getSettings } from "@/lib/settings";
import { windowState } from "@/lib/time";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REQUEST = 11 * 1024 * 1024;

export const POST = handle(async (req) => {
  assertSameOrigin(req);
  const ctx = getCtx();
  const ip = clientIp(req);
  await rateLimit(ctx, `upload:${ip}`, 60, 15 * 60);

  // Refuse oversized bodies before reading them.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (!declared || declared > MAX_REQUEST) throw new AppError(413, "FILE_TOO_LARGE", "The file is too large.");

  const form = await req.formData();
  const category = String(form.get("category") ?? "") as FileCategory;
  const uploadSession = String(form.get("uploadSession") ?? "");
  const file = form.get("file");
  if (!FILE_CATEGORIES.includes(category)) throw new AppError(400, "VALIDATION_ERROR", "Unknown file category.");
  if (!UUID.test(uploadSession)) throw new AppError(400, "VALIDATION_ERROR", "Missing upload session.");
  if (!(file instanceof File)) throw new AppError(400, "VALIDATION_ERROR", "Choose a file to upload.");

  // Uploads are only accepted while the form that uses them is open.
  const settings = await getSettings(ctx);
  const [openAt, closeAt] = category === "PAYMENT_SCREENSHOT" ? [settings.phase2OpenAt, settings.phase2CloseAt] : [settings.phase1OpenAt, settings.phase1CloseAt];
  if (windowState(ctx.now(), openAt, closeAt) !== "open") throw new AppError(403, "WINDOW_CLOSED", "Uploads for this form are closed.");
  // Bounds storage use: per IP per day, and per form.
  await rateLimit(ctx, `upload-day:${ip}`, 300, 24 * 60 * 60);
  await rateLimit(ctx, `upload-session:${uploadSession}`, 30, 24 * 60 * 60);
  if (file.size > FILE_RULES[category].maxBytes) throw new AppError(413, "FILE_TOO_LARGE", `The file is too large. Allowed: ${FILE_RULES[category].label}.`);

  const bytes = new Uint8Array(await file.arrayBuffer());
  return jsonOk(await storeUpload(ctx, { category, bytes, originalName: file.name, uploadSession }), 201);
});
