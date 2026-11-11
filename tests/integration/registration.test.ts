import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { adminFromToken, login, logout } from "@/lib/auth/session";
import { emailOutbox, files, ideaSubmissions, participants, teams } from "@/lib/db/schema";
import { AppError } from "@/lib/http";
import { uuid } from "@/lib/ids";
import { cleanupOrphanUploads, storeUpload } from "@/lib/r2/files";
import { rateLimit } from "@/lib/security/ratelimit";
import { registerTeam } from "@/features/registration/service";
import { registrationSchema } from "@/features/registration/schema";
import { buildRegistration, createTestEnv, EXE, HTML, JPEG, makeAdmin, PDF, PLAIN_ZIP, T, TEST_PASSWORD, type TestEnv } from "../helpers";

let t: TestEnv;
beforeAll(async () => void (t = await createTestEnv()));
afterAll(() => t.dispose());

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "OK";
  } catch (e) {
    return e instanceof AppError ? e.code : `THROW:${String(e)}`;
  }
};
const fieldsOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as AppError).fields ?? {};
  }
  return {};
};

describe("registration", () => {
  test("creates team, participants, idea, attached files and one email per member", async () => {
    const input = await buildRegistration(t.ctx, 3);
    const res = await registerTeam(t.ctx, input, "1.1.1.1");
    expect(res).toMatchObject({ participantCount: 3 });
    const team = (await t.ctx.db.select().from(teams).where(eq(teams.registrationId, res.registrationId)))[0];
    expect(team.status).toBe("SUBMITTED");
    expect(await t.ctx.db.select().from(participants).where(eq(participants.teamId, team.id))).toHaveLength(3);
    expect(await t.ctx.db.select().from(ideaSubmissions).where(eq(ideaSubmissions.teamId, team.id))).toHaveLength(1);
    const attached = await t.ctx.db.select().from(files).where(eq(files.uploadSession, input.uploadSession));
    expect(attached).toHaveLength(4);
    expect(attached.every((f) => f.status === "ATTACHED")).toBe(true);
    const mail = await t.ctx.db.select().from(emailOutbox).where(eq(emailOutbox.teamId, team.id));
    expect(mail).toHaveLength(3);
    expect(new Set(mail.map((m) => m.toEmail)).size).toBe(3);
    expect(mail.every((m) => m.template === "registration_confirmation" && m.status === "QUEUED")).toBe(true);
  });

  test("the same idempotency key creates one team and returns the same answer", async () => {
    const input = await buildRegistration(t.ctx, 1);
    const before = (await t.ctx.db.select().from(teams)).length;
    const a = await registerTeam(t.ctx, input, "1.1.1.1");
    const b = await registerTeam(t.ctx, input, "1.1.1.1");
    expect(b).toEqual(a);
    expect((await t.ctx.db.select().from(teams)).length).toBe(before + 1);
  });

  test("duplicate email, student ID and team name are rejected on the right field with nothing written", async () => {
    const first = await buildRegistration(t.ctx, 2, { teamName: "Alpha Minds", emails: ["dup@example.com", "other@example.com"], studentIds: ["CSE-900", "CSE-901"] });
    await registerTeam(t.ctx, first, "1.1.1.1");
    const count = async () => [(await t.ctx.db.select().from(teams)).length, (await t.ctx.db.select().from(participants)).length];
    const before = await count();

    const byEmail = await buildRegistration(t.ctx, 1, { emails: ["DUP@example.com"] });
    expect(await fieldsOf(registerTeam(t.ctx, registrationSchema.parse(byEmail), "1.1.1.1"))).toHaveProperty("participants.0.email");
    const byStudent = await buildRegistration(t.ctx, 1, { studentIds: ["cse 900"] });
    expect(await fieldsOf(registerTeam(t.ctx, byStudent, "1.1.1.1"))).toHaveProperty("participants.0.studentId");
    const byName = await buildRegistration(t.ctx, 1, { teamName: "alpha   MINDS" });
    expect(await fieldsOf(registerTeam(t.ctx, registrationSchema.parse(byName), "1.1.1.1"))).toHaveProperty("team.name");
    expect(await count()).toEqual(before);
  });

  test("the same student ID at a different university is allowed", async () => {
    const a = await buildRegistration(t.ctx, 1, { studentIds: ["2020-1-60-001"], university: "University A" });
    const b = await buildRegistration(t.ctx, 1, { studentIds: ["2020-1-60-001"], university: "University B" });
    expect(await code(registerTeam(t.ctx, a, "1.1.1.1"))).toBe("OK");
    expect(await code(registerTeam(t.ctx, b, "1.1.1.1"))).toBe("OK");
  });

  test("two simultaneous registrations sharing an email: exactly one succeeds", async () => {
    const a = await buildRegistration(t.ctx, 1, { emails: ["race@example.com"] });
    const b = await buildRegistration(t.ctx, 1, { emails: ["race@example.com"] });
    const results = await Promise.all([code(registerTeam(t.ctx, a, "1.1.1.1")), code(registerTeam(t.ctx, b, "1.1.1.1"))]);
    expect(results.sort()).toEqual(["DUPLICATE", "OK"]);
    expect(await t.ctx.db.select().from(participants).where(eq(participants.email, "race@example.com"))).toHaveLength(1);
  });

  test("a file from another upload session, or of the wrong kind, cannot be attached", async () => {
    const mine = await buildRegistration(t.ctx, 1);
    const foreign = await storeUpload(t.ctx, { category: "STUDENT_ID", bytes: JPEG, uploadSession: uuid() });
    expect(await fieldsOf(registerTeam(t.ctx, { ...mine, participants: [{ ...mine.participants[0], idCardFileId: foreign.fileId }] }, "1.1.1.1"))).toHaveProperty("participants.0.idCardFileId");
    const wrongKind = await buildRegistration(t.ctx, 1);
    expect(await fieldsOf(registerTeam(t.ctx, { ...wrongKind, idea: { ...wrongKind.idea, documentFileId: wrongKind.participants[0].idCardFileId } }, "1.1.1.1"))).toHaveProperty("idea.documentFileId");
  });

  test("closed outside the Phase 1 window", async () => {
    const input = await buildRegistration(t.ctx, 1);
    t.setNow(Date.parse("2026-11-11T12:00:00+06:00"));
    expect(await code(registerTeam(t.ctx, input, "1.1.1.1"))).toBe("WINDOW_CLOSED");
    t.setNow(Date.parse("2026-11-19T00:00:01+06:00"));
    expect(await code(registerTeam(t.ctx, input, "1.1.1.1"))).toBe("WINDOW_CLOSED");
    t.setNow(T.phase1);
  });
});

describe("uploads", () => {
  test("wrong type and oversize are rejected and nothing is stored", async () => {
    const session = uuid();
    const before = (await t.ctx.files.list()).objects.length;
    for (const bad of [EXE, HTML, PLAIN_ZIP, PDF]) expect(await code(storeUpload(t.ctx, { category: "STUDENT_ID", bytes: bad, uploadSession: session }))).toBe("UNSUPPORTED_FILE_TYPE");
    expect(await code(storeUpload(t.ctx, { category: "IDEA_DOC", bytes: JPEG, uploadSession: session }))).toBe("UNSUPPORTED_FILE_TYPE");
    const big = new Uint8Array(3 * 1024 * 1024 + 1);
    big.set(JPEG);
    expect(await code(storeUpload(t.ctx, { category: "STUDENT_ID", bytes: big, uploadSession: session }))).toBe("FILE_TOO_LARGE");
    expect((await t.ctx.files.list()).objects.length).toBe(before);
    expect(await t.ctx.db.select().from(files).where(eq(files.uploadSession, session))).toHaveLength(0);
  });

  test("keys are server-generated and orphan cleanup removes object and row", async () => {
    const session = uuid();
    const up = await storeUpload(t.ctx, { category: "STUDENT_ID", bytes: JPEG, originalName: "../../evil.jpg", uploadSession: session });
    const row = (await t.ctx.db.select().from(files).where(eq(files.id, up.fileId)))[0];
    expect(row.r2Key).toBe(`student-id/${up.fileId}.jpg`);
    expect(row.originalName).toBe("evil.jpg");
    expect(await t.ctx.files.head(row.r2Key)).not.toBeNull();
    expect(await cleanupOrphanUploads(t.ctx)).toBe(0);
    t.setNow(T.phase1 + 25 * 60 * 60 * 1000);
    expect(await cleanupOrphanUploads(t.ctx)).toBeGreaterThanOrEqual(1);
    expect(await t.ctx.files.head(row.r2Key)).toBeNull();
    expect(await t.ctx.db.select().from(files).where(eq(files.id, up.fileId))).toHaveLength(0);
    t.setNow(T.phase1);
  });
});

describe("admin auth", () => {
  test("login, session lookup, idle expiry and logout", async () => {
    const admin = await makeAdmin(t.ctx, "REVIEWER", "rev@hack.test");
    const { token } = await login(t.ctx, " REV@hack.test ", TEST_PASSWORD, "1.1.1.1", "vitest");
    expect((await adminFromToken(t.ctx, token))?.id).toBe(admin.id);
    expect(await adminFromToken(t.ctx, "not-a-token")).toBeNull();
    expect(await adminFromToken(t.ctx, null)).toBeNull();
    // Only a hash of the token is stored.
    const stored = await t.ctx.db.query.adminSessions.findMany();
    expect(stored.some((s) => s.tokenHash === token)).toBe(false);

    t.setNow(T.phase1 + 3 * 60 * 60 * 1000);
    expect(await adminFromToken(t.ctx, token)).toBeNull();
    t.setNow(T.phase1);

    const again = await login(t.ctx, "rev@hack.test", TEST_PASSWORD, "1.1.1.1", null);
    await logout(t.ctx, again.token);
    expect(await adminFromToken(t.ctx, again.token)).toBeNull();
  });

  test("wrong password, unknown email and a disabled account fail identically", async () => {
    await makeAdmin(t.ctx, "REVIEWER", "known@hack.test");
    const disabled = await makeAdmin(t.ctx, "REVIEWER", "off@hack.test");
    await t.ctx.db.update((await import("@/lib/db/schema")).admins).set({ isActive: false }).where(eq((await import("@/lib/db/schema")).admins.id, disabled.id));
    const errors = [];
    for (const [email, pw] of [["known@hack.test", "wrong password!"], ["nobody@hack.test", TEST_PASSWORD], ["off@hack.test", TEST_PASSWORD]]) {
      try {
        await login(t.ctx, email, pw, "1.1.1.1", null);
        errors.push("OK");
      } catch (e) {
        errors.push(`${(e as AppError).status}:${(e as AppError).message}`);
      }
    }
    expect(new Set(errors).size).toBe(1);
    expect(errors[0]).toMatch(/^401:/);
  });
});

describe("rate limit", () => {
  test("the sixth request in a window is refused; a new window resets", async () => {
    for (let i = 0; i < 5; i++) await rateLimit(t.ctx, "reg:9.9.9.9", 5, 900);
    expect(await code(rateLimit(t.ctx, "reg:9.9.9.9", 5, 900))).toBe("RATE_LIMITED");
    expect(await code(rateLimit(t.ctx, "reg:8.8.8.8", 5, 900))).toBe("OK");
    t.setNow(T.phase1 + 16 * 60 * 1000);
    expect(await code(rateLimit(t.ctx, "reg:9.9.9.9", 5, 900))).toBe("OK");
    t.setNow(T.phase1);
  });
});
