import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPlatformProxy } from "wrangler";
import { makeCtx, type Ctx } from "@/lib/ctx";
import { hashPassword } from "@/lib/auth/password";
import { admins, type Admin, type AdminRole } from "@/lib/db/schema";
import { uuid } from "@/lib/ids";
import { storeUpload } from "@/lib/r2/files";
import type { RegistrationInput } from "@/features/registration/schema";

export const T = {
  phase1: Date.parse("2026-11-14T10:00:00+06:00"),
  review: Date.parse("2026-11-19T10:00:00+06:00"),
  phase2: Date.parse("2026-11-22T10:00:00+06:00"),
  eventDay: Date.parse("2026-11-24T10:00:00+06:00"),
};

export interface TestEnv {
  ctx: Ctx;
  /** Moves the clock. Every read of now() also advances it by 1 ms so rows order deterministically. */
  setNow(ms: number): void;
  dispose(): Promise<void>;
}

/** A real local D1 and R2 (workerd), fresh and in-memory for each call, with migrations applied. */
export async function createTestEnv(): Promise<TestEnv> {
  const proxy = await getPlatformProxy<{ DB: D1Database; FILES: R2Bucket }>({ persist: false });
  const dir = join(process.cwd(), "drizzle/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(join(dir, file), "utf8").split("--> statement-breakpoint")) {
      if (stmt.trim()) await proxy.env.DB.prepare(stmt).run();
    }
  }
  let clock = T.phase1;
  const ctx = makeCtx({ DB: proxy.env.DB, FILES: proxy.env.FILES, APP_ENV: "test", APP_URL: "https://hack.test", EMAIL_PROVIDER: "log", SESSION_SECRET: "test-secret", ADMIN_NOTIFY_EMAIL: "payments@hack.test" }, () => clock++);
  return { ctx, setNow: (ms) => void (clock = ms), dispose: () => proxy.dispose() };
}

// Hashing is slow by design; reuse one hash across tests.
export const TEST_PASSWORD = "correct horse battery";
let cachedHash: string | null = null;

export async function makeAdmin(ctx: Ctx, role: AdminRole = "SUPER_ADMIN", email = `${role.toLowerCase()}-${uuid().slice(0, 6)}@hack.test`): Promise<Admin> {
  cachedHash ??= await hashPassword(TEST_PASSWORD);
  const row = { id: uuid(), email, name: role, passwordHash: cachedHash, role, isActive: true, mustChangePassword: false, lastLoginAt: null, createdAt: ctx.now(), updatedAt: ctx.now() };
  await ctx.db.insert(admins).values(row);
  return row;
}

export const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1]);
export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);
export const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");
export const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0, 0xff, 0xff, 0, 0]);
export const HTML = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");
export const PLAIN_ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new TextEncoder().encode("readme.txt hello world, not a word file")]);
export const DOCX = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new TextEncoder().encode("....[Content_Types].xml....word/document.xml....")]);

let counter = 0;

/** Uploads real files and returns a valid registration payload for a team of `size`. */
export async function buildRegistration(ctx: Ctx, size: 1 | 2 | 3 = 2, overrides: Partial<{ teamName: string; emails: string[]; studentIds: string[]; university: string }> = {}): Promise<RegistrationInput> {
  const n = ++counter;
  const uploadSession = uuid();
  const participants = [];
  for (let i = 0; i < size; i++) {
    const id = await storeUpload(ctx, { category: "STUDENT_ID", bytes: JPEG, originalName: "id.jpg", uploadSession });
    participants.push({
      fullName: `Member ${n}-${i + 1}`,
      email: overrides.emails?.[i] ?? `m${n}-${i + 1}@example.com`,
      phone: "+8801712345678",
      whatsapp: "+8801712345678",
      university: overrides.university ?? "Comilla University",
      studentId: overrides.studentIds?.[i] ?? `CSE-${n}-${i + 1}`,
      tshirtSize: "L" as const,
      idCardFileId: id.fileId,
    });
  }
  const doc = await storeUpload(ctx, { category: "IDEA_DOC", bytes: PDF, originalName: "idea.pdf", uploadSession });
  const long = "An explanation that is comfortably longer than the fifty character minimum the form requires.";
  return {
    idempotencyKey: uuid(),
    uploadSession,
    team: { name: overrides.teamName ?? `Team ${n}`, size },
    participants,
    idea: { title: `Idea number ${n}`, problemStatement: long, proposedSolution: long, aiComponent: long, expectedImpact: long, documentFileId: doc.fileId },
    consents: { rules: true, accuracy: true, communications: true },
  };
}
