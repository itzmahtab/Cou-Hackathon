import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { emailOutbox, type Admin } from "@/lib/db/schema";
import { drainOutbox, enqueue } from "@/features/email/outbox";
import { sentLog } from "@/features/email/providers";
import { CANCELLED_NOTE, isEmailEnabled, setEmailEnabled } from "@/features/email/switch";
import { requestStatusOtp } from "@/features/status/service";
import { createTestEnv, makeAdmin, type TestEnv } from "../helpers";

let t: TestEnv;
let admin: Admin;
beforeAll(async () => {
  t = await createTestEnv();
  admin = await makeAdmin(t.ctx);
});
afterAll(() => t.dispose());

const mail = (n: string) => ({ template: "announcement" as const, to: `${n}@hack.test`, dedupe: n, payload: { subject: "Hi", body: "Body", name: n } });
const statusOf = async (n: string) => (await t.ctx.db.select().from(emailOutbox).where(eq(emailOutbox.dedupeKey, `announcement:${n}`)))[0];

describe("email switch", () => {
  test("is on by default and sends", async () => {
    expect(await isEmailEnabled(t.ctx)).toBe(true);
    await enqueue(t.ctx, [mail("a")]);
    expect((await drainOutbox(t.ctx)).sent).toBe(1);
    expect((await statusOf("a")).status).toBe("SENT");
  });

  test("turning it off cancels the queue, and nothing created later is sent", async () => {
    await enqueue(t.ctx, [mail("b"), mail("c")]);
    expect((await setEmailEnabled(t.ctx, false, admin.id)).cancelled).toBe(2);
    expect(await isEmailEnabled(t.ctx)).toBe(false);

    await enqueue(t.ctx, [mail("d")]);
    const before = sentLog.length;
    expect(await drainOutbox(t.ctx)).toEqual({ sent: 0, failed: 0 });
    expect(sentLog.length).toBe(before);
    for (const n of ["b", "c", "d"]) {
      const row = await statusOf(n);
      expect(row.status).toBe("DEAD");
      expect(row.lastError).toBe(CANCELLED_NOTE);
    }
  });

  test("status codes are refused while email is off", async () => {
    await expect(requestStatusOtp(t.ctx, "COU26-NOPE00", "x@hack.test")).rejects.toMatchObject({ code: "EMAIL_OFF" });
  });

  test("turning it back on sends new email but not the cancelled ones", async () => {
    await setEmailEnabled(t.ctx, true, admin.id);
    await enqueue(t.ctx, [mail("e")]);
    expect((await drainOutbox(t.ctx)).sent).toBe(1);
    expect((await statusOf("e")).status).toBe("SENT");
    expect((await statusOf("d")).status).toBe("DEAD");
  });
});
