import { eq } from "drizzle-orm";
import type { Permission } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/auth/session";
import { files } from "@/lib/db/schema";
import { AppError, clientIp, handle } from "@/lib/http";
import { rateLimit } from "@/lib/security/ratelimit";
import { requireAdmin } from "@/lib/server";

// Which permission unlocks each kind of document.
const REQUIRED: Record<string, Permission> = {
  STUDENT_ID: "registrations.contact",
  IDEA_DOC: "reviews.read",
  PAYMENT_SCREENSHOT: "payments.verify",
};

export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { ctx, admin } = await requireAdmin();
  await rateLimit(ctx, `admin-file:${admin.id}`, 600, 60 * 60);
  const file = (await ctx.db.select().from(files).where(eq(files.id, id)).limit(1))[0];
  // Same answer for "does not exist" and "not yours to see".
  const notFound = new AppError(404, "NOT_FOUND", "File not found.");
  if (!file || file.status !== "ATTACHED") throw notFound;
  const { can } = await import("@/lib/auth/permissions");
  const allowed = can(admin.role, REQUIRED[file.category]) || (file.category === "IDEA_DOC" && can(admin.role, "registrations.contact"));
  if (!allowed) throw new AppError(403, "FORBIDDEN", "Your role does not allow this file.");

  const object = await ctx.files.get(file.r2Key);
  if (!object) throw notFound;
  await logActivity(ctx, { adminId: admin.id, action: "file.view", entityType: "file", entityId: file.id, detail: { category: file.category }, ip: clientIp(req) });

  const inline = file.contentType.startsWith("image/");
  const ext = file.r2Key.split(".").pop();
  return new Response(object.body as unknown as ReadableStream, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.sizeBytes),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${file.category.toLowerCase()}-${file.id.slice(0, 8)}.${ext}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
});
