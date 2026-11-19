import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { emailOutbox, participants, teams, type Admin } from "@/lib/db/schema";
import { AppError } from "@/lib/http";
import { registerTeam } from "@/features/registration/service";
import { saveReview } from "@/features/reviews/service";
import { finaliseShortlist, promoteFromWaitlist, releaseFromWaitlist, setCandidate, setWaitlistPosition, waitlistIds } from "@/features/shortlist/service";
import { settingsUpserts } from "@/lib/settings";
import { buildRegistration, createTestEnv, makeAdmin, T, type TestEnv } from "../helpers";

let t: TestEnv;
let superAdmin: Admin, reviewer: Admin;
const ids: string[] = [];

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "OK";
  } catch (e) {
    return e instanceof AppError ? e.code : `THROW:${String(e)}`;
  }
};
const teamOf = async (id: string) => (await t.ctx.db.select().from(teams).where(eq(teams.id, id)))[0];
const mailFor = async (teamId: string) => (await t.ctx.db.select().from(emailOutbox).where(eq(emailOutbox.teamId, teamId))).filter((m) => m.template === "shortlisted" || m.template === "not_selected");

beforeAll(async () => {
  t = await createTestEnv();
  superAdmin = await makeAdmin(t.ctx, "SUPER_ADMIN");
  reviewer = await makeAdmin(t.ctx, "REVIEWER");
  for (let i = 0; i < 7; i++) {
    const res = await registerTeam(t.ctx, await buildRegistration(t.ctx, 2), "1.1.1.1");
    ids.push((await t.ctx.db.select({ id: teams.id }).from(teams).where(eq(teams.registrationId, res.registrationId)))[0].id);
  }
  t.setNow(T.review);
  for (const id of ids) await saveReview(t.ctx, reviewer, id, { scoreRelevance: 15, scoreInnovation: 20, scoreAi: 20, scoreFeasibility: 10, scoreImpact: 10, notes: "" });
  await t.ctx.db.batch(settingsUpserts(t.ctx, { shortlistCapacity: 2 }, superAdmin.id) as never);
});
afterAll(() => t.dispose());

describe("waitlist", () => {
  test("queue order: insert at a position, move, remove, and gaps close", async () => {
    await setCandidate(t.ctx, reviewer, ids[0], true);
    await setCandidate(t.ctx, reviewer, ids[1], true);
    await setWaitlistPosition(t.ctx, reviewer, ids[2], 1);
    await setWaitlistPosition(t.ctx, reviewer, ids[3], 2);
    await setWaitlistPosition(t.ctx, reviewer, ids[4], 1); // jumps the queue
    await setWaitlistPosition(t.ctx, reviewer, ids[5], 99); // clamps to the end
    expect(await waitlistIds(t.ctx)).toEqual([ids[4], ids[2], ids[3], ids[5]]);

    await setWaitlistPosition(t.ctx, reviewer, ids[5], 2); // move
    expect(await waitlistIds(t.ctx)).toEqual([ids[4], ids[5], ids[2], ids[3]]);
    await setWaitlistPosition(t.ctx, reviewer, ids[5], null); // remove
    expect(await waitlistIds(t.ctx)).toEqual([ids[4], ids[2], ids[3]]);
    expect((await teamOf(ids[3])).waitlistPosition).toBe(3);
    expect((await teamOf(ids[5])).waitlistPosition).toBeNull();
  });

  test("a selected team cannot be waitlisted; promoting before finalising is an ordinary selection", async () => {
    expect(await code(setWaitlistPosition(t.ctx, reviewer, ids[0], 1))).toBe("INVALID_TRANSITION");
    expect(await code(promoteFromWaitlist(t.ctx, reviewer, ids[5]))).toBe("INVALID_TRANSITION"); // not on the waitlist
    expect(await code(promoteFromWaitlist(t.ctx, reviewer, ids[4]))).toBe("SHORTLIST_FULL");
    await setCandidate(t.ctx, reviewer, ids[1], false);
    await promoteFromWaitlist(t.ctx, reviewer, ids[4]);
    expect(await teamOf(ids[4])).toMatchObject({ isShortlistCandidate: true, waitlistPosition: null });
    expect(await waitlistIds(t.ctx)).toEqual([ids[2], ids[3]]);
    expect((await teamOf(ids[2])).waitlistPosition).toBe(1);
  });

  test("finalising leaves waitlisted teams in review with no email", async () => {
    await finaliseShortlist(t.ctx, superAdmin);
    expect((await teamOf(ids[0])).status).toBe("SHORTLISTED");
    expect((await teamOf(ids[1])).status).toBe("NOT_SELECTED");
    expect(await teamOf(ids[2])).toMatchObject({ status: "UNDER_REVIEW", waitlistPosition: 1 });
    expect(await teamOf(ids[3])).toMatchObject({ status: "UNDER_REVIEW", waitlistPosition: 2 });
    expect(await mailFor(ids[2])).toHaveLength(0);
    expect(await mailFor(ids[3])).toHaveLength(0);
    expect((await mailFor(ids[1])).every((m) => m.template === "not_selected")).toBe(true);
    expect(await code(setWaitlistPosition(t.ctx, superAdmin, ids[6], 1))).toBe("ALREADY_FINALISED");
  });

  test("after finalising: promote shortlists and emails the team; release marks it not selected and emails it", async () => {
    const members = (await t.ctx.db.select().from(participants).where(eq(participants.teamId, ids[2]))).length;
    const res = await promoteFromWaitlist(t.ctx, superAdmin, ids[2]);
    expect(res.emailsQueued).toBeGreaterThan(0);
    expect(await teamOf(ids[2])).toMatchObject({ status: "SHORTLISTED", isShortlistCandidate: true, waitlistPosition: null });
    const mail = await mailFor(ids[2]);
    expect(mail).toHaveLength(members);
    expect(mail.every((m) => m.template === "shortlisted")).toBe(true);
    expect((await teamOf(ids[3])).waitlistPosition).toBe(1);

    await releaseFromWaitlist(t.ctx, superAdmin, ids[3]);
    expect(await teamOf(ids[3])).toMatchObject({ status: "NOT_SELECTED", waitlistPosition: null });
    expect((await mailFor(ids[3])).every((m) => m.template === "not_selected")).toBe(true);
    expect(await waitlistIds(t.ctx)).toEqual([]);
    expect(await code(promoteFromWaitlist(t.ctx, superAdmin, ids[3]))).toBe("INVALID_TRANSITION");
  });
});
