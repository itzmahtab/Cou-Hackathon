import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { emailOutbox, showcaseMembers, showcaseRegistrations, teams } from "@/lib/db/schema";
import { AppError } from "@/lib/http";
import { SHOWCASE_ID_PATTERN } from "@/lib/ids";
import { showcaseSchema, type ShowcaseInput } from "@/features/showcase/schema";
import { deleteShowcase, listShowcase, registerShowcase, rejectShowcase, showcaseStats, verifyShowcase } from "@/features/showcase/service";
import { createTestEnv, makeAdmin, T, type TestEnv } from "../helpers";

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

let n = 0;
function input(size: 1 | 2 | 3 | 4 = 2, o: Partial<{ emails: string[]; ids: string[]; trx: string }> = {}): ShowcaseInput {
  const k = ++n;
  return showcaseSchema.parse({
    idempotencyKey: crypto.randomUUID(),
    teamSize: size,
    members: Array.from({ length: size }, (_, i) => ({
      fullName: `Student ${k}-${i + 1}`,
      studentId: o.ids?.[i] ?? `12${k}0${i + 1}`,
      department: "CSE",
      session: "2021-22",
      email: o.emails?.[i] ?? `s${k}-${i}@cou.test`,
      phone: "01712345678",
    })),
    project: { title: `Smart project ${k}`, category: "Robotics & Automation", description: "A working prototype that solves a campus problem with sensors." },
    payment: { senderPhone: "01712345678", transactionId: o.trx ?? `SHOWTRX${k}000` },
    consents: { student: true, accuracy: true },
  });
}

describe("showcase registration", () => {
  test("schema: team of 1 to 4, sizes must match, consents required", () => {
    const ok = input(4);
    expect(ok.members).toHaveLength(4);
    const raw = { ...ok, teamSize: 3 };
    expect(showcaseSchema.safeParse(raw).success).toBe(false);
    expect(showcaseSchema.safeParse({ ...ok, teamSize: 5, members: [...ok.members, ok.members[0]] }).success).toBe(false);
    expect(showcaseSchema.safeParse({ ...ok, consents: { student: false, accuracy: true } }).success).toBe(false);
  });

  test("stores the team separately from the hackathon and emails every member", async () => {
    const before = (await t.ctx.db.select().from(teams)).length;
    const res = await registerShowcase(t.ctx, input(3), "1.1.1.1");
    expect(res.registrationId).toMatch(SHOWCASE_ID_PATTERN);
    expect(res.feeBdt).toBe(150);
    const reg = (await t.ctx.db.select().from(showcaseRegistrations).where(eq(showcaseRegistrations.registrationId, res.registrationId)))[0];
    expect(reg).toMatchObject({ status: "PENDING_VERIFICATION", teamSize: 3, feeBdt: 150 });
    expect(await t.ctx.db.select().from(showcaseMembers).where(eq(showcaseMembers.registrationId, reg.id))).toHaveLength(3);
    expect((await t.ctx.db.select().from(teams)).length).toBe(before);
    const mail = (await t.ctx.db.select().from(emailOutbox)).filter((m) => m.template === "showcase_received" && JSON.parse(m.payloadJson).registrationId === res.registrationId);
    expect(mail).toHaveLength(3);
  });

  test("the same idempotency key returns the same registration", async () => {
    const i = input(1);
    const a = await registerShowcase(t.ctx, i, "1.1.1.1");
    const b = await registerShowcase(t.ctx, i, "1.1.1.1");
    expect(b).toEqual(a);
    expect(await t.ctx.db.select().from(showcaseRegistrations).where(eq(showcaseRegistrations.registrationId, a.registrationId))).toHaveLength(1);
  });

  test("duplicate email, student ID and transaction ID are refused on the right field", async () => {
    await registerShowcase(t.ctx, input(1, { emails: ["dup@cou.test"], ids: ["999-001"], trx: "DUPTRX0001" }), "1.1.1.1");
    for (const [o, field] of [
      [{ emails: ["DUP@cou.test"] }, "members.0.email"],
      [{ ids: ["999 001"] }, "members.0.studentId"],
      [{ trx: "duptrx0001" }, "payment.transactionId"],
    ] as const) {
      try {
        await registerShowcase(t.ctx, input(1, o as never), "1.1.1.1");
        throw new Error("expected duplicate");
      } catch (e) {
        expect((e as AppError).code).toBe("DUPLICATE");
        expect((e as AppError).fields).toHaveProperty(field);
      }
    }
  });

  test("closed outside 13 – 22 November", async () => {
    t.setNow(Date.parse("2026-11-12T23:59:00+06:00"));
    expect(await code(registerShowcase(t.ctx, input(1), "1.1.1.1"))).toBe("WINDOW_CLOSED");
    t.setNow(Date.parse("2026-11-23T00:00:01+06:00"));
    expect(await code(registerShowcase(t.ctx, input(1), "1.1.1.1"))).toBe("WINDOW_CLOSED");
    t.setNow(T.phase1);
  });

  test("verify confirms once and emails; reject needs a reason; only rejected entries can be deleted", async () => {
    const admin = await makeAdmin(t.ctx, "PAYMENT_ADMIN");
    const a = await registerShowcase(t.ctx, input(2), "1.1.1.1");
    const b = await registerShowcase(t.ctx, input(2, { emails: ["redo1@cou.test", "redo2@cou.test"] }), "1.1.1.1");
    const idOf = async (rid: string) => (await t.ctx.db.select().from(showcaseRegistrations).where(eq(showcaseRegistrations.registrationId, rid)))[0].id;
    const ida = await idOf(a.registrationId);
    const idb = await idOf(b.registrationId);

    await verifyShowcase(t.ctx, admin, ida);
    expect(await code(verifyShowcase(t.ctx, admin, ida))).toBe("INVALID_TRANSITION");
    expect(await code(deleteShowcase(t.ctx, admin, ida))).toBe("INVALID_TRANSITION");
    const confirmedMail = (await t.ctx.db.select().from(emailOutbox)).filter((m) => m.template === "showcase_confirmed" && JSON.parse(m.payloadJson).registrationId === a.registrationId);
    expect(confirmedMail).toHaveLength(2);

    expect(await code(rejectShowcase(t.ctx, admin, idb, " "))).toBe("VALIDATION_ERROR");
    await rejectShowcase(t.ctx, admin, idb, "Transaction not found in the bKash statement");
    expect((await t.ctx.db.select().from(showcaseRegistrations).where(eq(showcaseRegistrations.id, idb)))[0]).toMatchObject({ status: "REJECTED" });

    // Deleting the rejected entry frees the students to register again.
    await deleteShowcase(t.ctx, admin, idb);
    expect(await code(registerShowcase(t.ctx, input(2, { emails: ["redo1@cou.test", "redo2@cou.test"] }), "1.1.1.1"))).toBe("OK");

    const stats = await showcaseStats(t.ctx);
    expect(stats.confirmed).toBe(1);
    expect(stats.feesConfirmed).toBe(100);
    const found = await listShowcase(t.ctx, { q: a.registrationId });
    expect(found).toHaveLength(1);
    expect(found[0].members).toHaveLength(2);
    expect(await listShowcase(t.ctx, { status: "CONFIRMED" })).toHaveLength(1);
  });
});
