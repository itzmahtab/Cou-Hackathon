import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { adminActivityLogs, attendance, emailOutbox, ideaReviews, participants, payments, paymentVerificationLogs, shortlistSelections, teams, type Admin } from "@/lib/db/schema";
import { AppError } from "@/lib/http";
import { drainOutbox, resendEmail, statusSignature, verifyStatusSignature } from "@/features/email/outbox";
import { sentLog } from "@/features/email/providers";
import { rejectPayment, setAttendance, submitPayment, verifyPayment } from "@/features/payments/service";
import { registerTeam } from "@/features/registration/service";
import { autoRank, getPublicLeaderboard, publishResults, saveResult, unpublishResults } from "@/features/results/service";
import { saveReview } from "@/features/reviews/service";
import { candidateCount, finaliseShortlist, queueSelectionEmails, setCandidate } from "@/features/shortlist/service";
import { getTeamStatus, readStatusCookie, requestStatusOtp, signStatusCookie, verifyStatusOtp } from "@/features/status/service";
import { settingsUpserts } from "@/lib/settings";
import { buildRegistration, createTestEnv, makeAdmin, T, type TestEnv } from "../helpers";

let t: TestEnv;
let superAdmin: Admin, reviewer: Admin, reviewer2: Admin, payAdmin: Admin, resultsAdmin: Admin;
const teamIds: string[] = [];
const regIds: string[] = [];

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "OK";
  } catch (e) {
    return e instanceof AppError ? e.code : `THROW:${String(e)}`;
  }
};
const review = (n: number) => ({ scoreRelevance: Math.min(20, n), scoreInnovation: 20, scoreAi: 20, scoreFeasibility: 10, scoreImpact: 10, notes: "private note" });
const pay = (trx: string) => ({ provider: "BKASH" as const, senderPhone: "+8801712345678", transactionId: trx, amountBdt: 1350 });
const teamOf = async (id: string) => (await t.ctx.db.select().from(teams).where(eq(teams.id, id)))[0];

beforeAll(async () => {
  t = await createTestEnv();
  superAdmin = await makeAdmin(t.ctx, "SUPER_ADMIN");
  reviewer = await makeAdmin(t.ctx, "REVIEWER");
  reviewer2 = await makeAdmin(t.ctx, "REVIEWER");
  payAdmin = await makeAdmin(t.ctx, "PAYMENT_ADMIN");
  resultsAdmin = await makeAdmin(t.ctx, "RESULTS_ADMIN");
  // 33 teams: enough to hit the 30-team cap.
  for (let i = 0; i < 33; i++) {
    const res = await registerTeam(t.ctx, await buildRegistration(t.ctx, ((i % 3) + 1) as 1 | 2 | 3), "1.1.1.1");
    regIds.push(res.registrationId);
    teamIds.push((await t.ctx.db.select({ id: teams.id }).from(teams).where(eq(teams.registrationId, res.registrationId)))[0].id);
  }
});
afterAll(() => t.dispose());

describe("reviews", () => {
  test("first review moves the team to UNDER_REVIEW; the mean covers all reviewers; one row per reviewer", async () => {
    t.setNow(T.review);
    await saveReview(t.ctx, reviewer, teamIds[0], review(20));
    expect(await teamOf(teamIds[0])).toMatchObject({ status: "UNDER_REVIEW", reviewScoreAvg: 80, reviewCount: 1 });
    await saveReview(t.ctx, reviewer2, teamIds[0], review(10));
    expect(await teamOf(teamIds[0])).toMatchObject({ reviewScoreAvg: 75, reviewCount: 2 });
    await saveReview(t.ctx, reviewer, teamIds[0], review(0));
    expect(await teamOf(teamIds[0])).toMatchObject({ reviewScoreAvg: 65, reviewCount: 2 });
    expect(await t.ctx.db.select().from(ideaReviews).where(eq(ideaReviews.teamId, teamIds[0]))).toHaveLength(2);
  });
});

describe("shortlist", () => {
  test("30 are accepted and the 31st is refused", async () => {
    for (let i = 0; i < 30; i++) await setCandidate(t.ctx, reviewer, teamIds[i], true);
    expect(await candidateCount(t.ctx)).toBe(30);
    expect(await code(setCandidate(t.ctx, reviewer, teamIds[30], true))).toBe("SHORTLIST_FULL");
    expect(await candidateCount(t.ctx)).toBe(30);
  });

  test("override needs a super admin and a real justification, and is recorded", async () => {
    expect(await code(setCandidate(t.ctx, reviewer, teamIds[30], true, "This team tied for thirtieth place on score."))).toBe("FORBIDDEN");
    expect(await code(setCandidate(t.ctx, superAdmin, teamIds[30], true, "too short"))).toBe("VALIDATION_ERROR");
    expect(await candidateCount(t.ctx)).toBe(30);
    await setCandidate(t.ctx, superAdmin, teamIds[30], true, "This team tied for thirtieth place on score.");
    expect(await candidateCount(t.ctx)).toBe(31);
    const log = await t.ctx.db.select().from(shortlistSelections).where(and(eq(shortlistSelections.teamId, teamIds[30]), eq(shortlistSelections.action, "OVERRIDE_ADD")));
    expect(log).toHaveLength(1);
    expect(log[0].adminId).toBe(superAdmin.id);
    await setCandidate(t.ctx, superAdmin, teamIds[30], false);
    expect(await candidateCount(t.ctx)).toBe(30);
  });

  test("two admins adding at 29 at the same moment: only one gets the last place", async () => {
    await setCandidate(t.ctx, reviewer, teamIds[29], false);
    expect(await candidateCount(t.ctx)).toBe(29);
    const results = await Promise.all([code(setCandidate(t.ctx, reviewer, teamIds[31], true)), code(setCandidate(t.ctx, reviewer2, teamIds[32], true))]);
    expect(results.sort()).toEqual(["OK", "SHORTLIST_FULL"]);
    expect(await candidateCount(t.ctx)).toBe(30);
    // Restore: teams 0..29 are the candidates.
    await setCandidate(t.ctx, reviewer, teamIds[31], false);
    await setCandidate(t.ctx, reviewer, teamIds[32], false);
    await setCandidate(t.ctx, reviewer, teamIds[29], true);
  });

  test("finalising sets statuses, queues exactly one email per participant, and cannot be repeated", async () => {
    const res = await finaliseShortlist(t.ctx, superAdmin);
    expect(res.shortlisted).toBe(30);
    const all = await t.ctx.db.select().from(teams);
    expect(all.filter((x) => x.status === "SHORTLISTED")).toHaveLength(30);
    expect(all.filter((x) => x.status === "NOT_SELECTED")).toHaveLength(3);

    const people = await t.ctx.db.select().from(participants);
    const mail = (await t.ctx.db.select().from(emailOutbox)).filter((m) => m.template === "shortlisted" || m.template === "not_selected");
    expect(mail).toHaveLength(people.length);
    expect(new Set(mail.map((m) => m.participantId)).size).toBe(people.length);
    const notSelectedTeam = teamIds[32];
    expect(mail.filter((m) => m.teamId === notSelectedTeam).every((m) => m.template === "not_selected")).toBe(true);

    expect(await code(finaliseShortlist(t.ctx, superAdmin))).toBe("ALREADY_FINALISED");
    await queueSelectionEmails(t.ctx);
    const after = (await t.ctx.db.select().from(emailOutbox)).filter((m) => m.template === "shortlisted" || m.template === "not_selected");
    expect(after).toHaveLength(people.length);

    expect(await code(setCandidate(t.ctx, superAdmin, teamIds[32], true))).toBe("ALREADY_FINALISED");
    expect(await code(saveReview(t.ctx, reviewer, teamIds[1], review(5)))).toBe("INVALID_TRANSITION");
  });
});

describe("payments", () => {
  test("only shortlisted teams, only inside the window, only the exact fee", async () => {
    expect(await code(submitPayment(t.ctx, teamIds[0], pay("EARLY00001")))).toBe("WINDOW_CLOSED");
    t.setNow(T.phase2);
    expect(await code(submitPayment(t.ctx, teamIds[32], pay("NOTSEL0001")))).toBe("FORBIDDEN");
    expect(await code(submitPayment(t.ctx, teamIds[0], { ...pay("WRONGAMT01"), amountBdt: 1000 }))).toBe("VALIDATION_ERROR");
    expect(await t.ctx.db.select().from(payments)).toHaveLength(0);
  });

  test("submission, duplicate transaction ID and a second pending submission", async () => {
    expect((await submitPayment(t.ctx, teamIds[0], pay("TRX0000001"))).status).toBe("PENDING_VERIFICATION");
    expect((await getTeamStatus(t.ctx, teamIds[0]))!.stage).toBe("PAYMENT_VERIFICATION");
    expect(await code(submitPayment(t.ctx, teamIds[1], pay("TRX0000001")))).toBe("DUPLICATE");
    expect(await code(submitPayment(t.ctx, teamIds[0], pay("TRX0000002")))).toBe("DUPLICATE");
    // The same ID through the other provider is a different transaction.
    expect(await code(submitPayment(t.ctx, teamIds[1], { ...pay("TRX0000001"), provider: "NAGAD" }))).toBe("OK");
    const mail = (await t.ctx.db.select().from(emailOutbox)).filter((m) => m.template === "payment_received" && m.teamId === teamIds[0]);
    expect(mail).toHaveLength((await teamOf(teamIds[0])).size);
    expect((await t.ctx.db.select().from(emailOutbox)).filter((m) => m.template === "admin_payment_notice")).toHaveLength(2);
  });

  test("verify confirms the team once; a second verify and a second approved payment are impossible", async () => {
    const p = (await t.ctx.db.select().from(payments).where(eq(payments.teamId, teamIds[0])))[0];
    await verifyPayment(t.ctx, payAdmin, p.id, "matched statement");
    expect((await teamOf(teamIds[0])).status).toBe("CONFIRMED");
    expect((await t.ctx.db.select().from(payments).where(eq(payments.id, p.id)))[0]).toMatchObject({ status: "VERIFIED", decidedBy: payAdmin.id });
    expect(await t.ctx.db.select().from(paymentVerificationLogs).where(eq(paymentVerificationLogs.paymentId, p.id))).toHaveLength(1);
    expect(await code(verifyPayment(t.ctx, payAdmin, p.id))).toBe("INVALID_TRANSITION");
    expect(await t.ctx.db.select().from(paymentVerificationLogs).where(eq(paymentVerificationLogs.paymentId, p.id))).toHaveLength(1);
    expect(await code(submitPayment(t.ctx, teamIds[0], pay("TRX0000009")))).toBe("INVALID_TRANSITION");
    const mail = (await t.ctx.db.select().from(emailOutbox)).filter((m) => m.template === "payment_verified" && m.teamId === teamIds[0]);
    expect(mail).toHaveLength((await teamOf(teamIds[0])).size);
    // The database itself refuses a second VERIFIED row for the team.
    await expect(
      t.ctx.db.insert(payments).values({ id: crypto.randomUUID(), teamId: teamIds[0], provider: "NAGAD", senderPhone: "+8801712345678", transactionId: "FORCED0001", amountBdt: 1350, status: "VERIFIED", createdAt: 1, updatedAt: 1 }),
    ).rejects.toThrow();
  });

  test("two admins verifying the same payment at once: one wins", async () => {
    await submitPayment(t.ctx, teamIds[2], pay("TRX0000003"));
    const p = (await t.ctx.db.select().from(payments).where(eq(payments.teamId, teamIds[2])))[0];
    const results = await Promise.all([code(verifyPayment(t.ctx, payAdmin, p.id)), code(verifyPayment(t.ctx, superAdmin, p.id))]);
    expect(results.sort()).toEqual(["INVALID_TRANSITION", "OK"]);
    expect(await t.ctx.db.select().from(paymentVerificationLogs).where(eq(paymentVerificationLogs.paymentId, p.id))).toHaveLength(1);
  });

  test("reject needs a reason, emails the team, and resubmission follows the setting", async () => {
    const p = (await t.ctx.db.select().from(payments).where(eq(payments.teamId, teamIds[1])))[0];
    expect(await code(rejectPayment(t.ctx, payAdmin, p.id, "  "))).toBe("VALIDATION_ERROR");
    await rejectPayment(t.ctx, payAdmin, p.id, "Transaction ID not found on the statement.");
    expect((await teamOf(teamIds[1])).status).toBe("SHORTLISTED");
    const status = (await getTeamStatus(t.ctx, teamIds[1]))!;
    expect(status).toMatchObject({ stage: "PAYMENT_PENDING", canPay: true });
    expect(status.payment?.rejectionReason).toMatch(/not found/);
    expect((await t.ctx.db.select().from(emailOutbox)).filter((m) => m.template === "payment_rejected" && m.teamId === teamIds[1]).length).toBeGreaterThan(0);

    await t.ctx.db.batch(settingsUpserts(t.ctx, { allowResubmission: false }, superAdmin.id) as never);
    expect(await code(submitPayment(t.ctx, teamIds[1], pay("TRX0000010")))).toBe("FORBIDDEN");
    await t.ctx.db.batch(settingsUpserts(t.ctx, { allowResubmission: true }, superAdmin.id) as never);
    expect(await code(submitPayment(t.ctx, teamIds[1], pay("TRX0000010")))).toBe("OK");
  });
});

describe("status access", () => {
  test("personal link signature", async () => {
    const p = (await t.ctx.db.select().from(participants).where(eq(participants.teamId, teamIds[0])))[0];
    const sig = await statusSignature(t.ctx, p.id);
    expect(await verifyStatusSignature(t.ctx, p.id, sig)).toBe(true);
    expect(await verifyStatusSignature(t.ctx, p.id, sig.replace(/.$/, "0") === sig ? sig.replace(/.$/, "1") : sig.replace(/.$/, "0"))).toBe(false);
    const other = (await t.ctx.db.select().from(participants).where(eq(participants.teamId, teamIds[1])))[0];
    expect(await verifyStatusSignature(t.ctx, other.id, sig)).toBe(false);
  });

  test("status cookie is bound to one team and expires", async () => {
    const cookie = await signStatusCookie(t.ctx, teamIds[0]);
    expect(await readStatusCookie(t.ctx, cookie)).toBe(teamIds[0]);
    expect(await readStatusCookie(t.ctx, cookie.replace(teamIds[0], teamIds[1]))).toBeNull();
    t.setNow(T.phase2 + 31 * 60 * 1000);
    expect(await readStatusCookie(t.ctx, cookie)).toBeNull();
    t.setNow(T.phase2 + 1000);
  });

  test("one-time code: works once, locks after five wrong tries, and a mismatch is indistinguishable", async () => {
    const p = (await t.ctx.db.select().from(participants).where(eq(participants.teamId, teamIds[3])))[0];
    const otpMail = async () => (await t.ctx.db.select().from(emailOutbox)).filter((m) => m.template === "status_otp");
    const before = (await otpMail()).length;
    await expect(requestStatusOtp(t.ctx, regIds[3], "stranger@example.com")).resolves.toBeUndefined();
    await expect(requestStatusOtp(t.ctx, "COU26-000000", p.email)).resolves.toBeUndefined();
    expect((await otpMail()).length).toBe(before);

    await requestStatusOtp(t.ctx, regIds[3].toLowerCase(), p.email.toUpperCase());
    const mail = await otpMail();
    expect(mail.length).toBe(before + 1);
    const good = JSON.parse(mail.at(-1)!.payloadJson).code as string;
    const bad = good === "000000" ? "111111" : "000000";
    expect(await code(verifyStatusOtp(t.ctx, regIds[3], p.email, bad))).toBe("INVALID_CODE");
    expect(await verifyStatusOtp(t.ctx, regIds[3], p.email, good)).toBe(teamIds[3]);
    expect(await code(verifyStatusOtp(t.ctx, regIds[3], p.email, good))).toBe("INVALID_CODE");

    await requestStatusOtp(t.ctx, regIds[3], p.email);
    const second = JSON.parse((await otpMail()).at(-1)!.payloadJson).code as string;
    const wrong = second === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect(await code(verifyStatusOtp(t.ctx, regIds[3], p.email, wrong))).toBe("INVALID_CODE");
    expect(await code(verifyStatusOtp(t.ctx, regIds[3], p.email, second))).toBe("INVALID_CODE");
  });

  test("the status view carries no contact details or student IDs", async () => {
    const people = await t.ctx.db.select().from(participants).where(eq(participants.teamId, teamIds[0]));
    const body = JSON.stringify(await getTeamStatus(t.ctx, teamIds[0]));
    for (const p of people) {
      expect(body).not.toContain(p.email);
      expect(body).not.toContain(p.studentId);
      expect(body).not.toContain(p.phone);
    }
  });
});

describe("email outbox", () => {
  test("drains queued mail, retries failures with backoff, then marks dead; resend creates a new row", async () => {
    sentLog.length = 0;
    const queuedBefore = (await t.ctx.db.select().from(emailOutbox).where(eq(emailOutbox.status, "QUEUED"))).length;
    const first = await drainOutbox(t.ctx, 7);
    expect(first).toEqual({ sent: 7, failed: 0 });
    expect(sentLog).toHaveLength(7);
    expect((await t.ctx.db.select().from(emailOutbox).where(eq(emailOutbox.status, "QUEUED"))).length).toBe(queuedBefore - 7);

    // Overlapping drains never send the same row twice.
    sentLog.length = 0;
    const [a, b] = await Promise.all([drainOutbox(t.ctx, 10), drainOutbox(t.ctx, 10)]);
    expect(new Set(sentLog.map((s) => `${s.to}|${s.subject}|${s.text}`)).size).toBe(sentLog.length);
    expect(a.sent + b.sent).toBe(sentLog.length);

    while ((await drainOutbox(t.ctx, 50)).sent > 0);
    // A misconfigured provider leaves mail queued without spending retries.
    const misconfigured = { ...t.ctx, env: { ...t.ctx.env, EMAIL_PROVIDER: "smtp", SMTP_PASSWORD: undefined } };
    const failing = { ...t.ctx, env: { ...t.ctx.env, EMAIL_PROVIDER: "test-fail" } };
    const sentRow = (await t.ctx.db.select().from(emailOutbox).where(eq(emailOutbox.status, "SENT")))[0];
    const resentId = await resendEmail(t.ctx, sentRow.id, superAdmin.id);
    let row = (await t.ctx.db.select().from(emailOutbox).where(eq(emailOutbox.id, resentId)))[0];
    expect(row).toMatchObject({ status: "QUEUED", requestedBy: superAdmin.id, toEmail: sentRow.toEmail });
    expect(await drainOutbox(misconfigured, 5)).toEqual({ sent: 0, failed: 0 });
    row = (await t.ctx.db.select().from(emailOutbox).where(eq(emailOutbox.id, resentId)))[0];
    expect(row).toMatchObject({ status: "QUEUED", attempts: 0 });
    expect(row.lastError).toMatch(/SMTP_PASSWORD/);

    for (let attempt = 1; attempt <= 5; attempt++) {
      const res = await drainOutbox(failing, 5);
      expect(res).toEqual({ sent: 0, failed: 1 });
      row = (await t.ctx.db.select().from(emailOutbox).where(eq(emailOutbox.id, resentId)))[0];
      expect(row.attempts).toBe(attempt);
      expect(row.lastError).toMatch(/simulated provider outage/);
      if (attempt < 5) {
        expect(row.status).toBe("QUEUED");
        expect(await drainOutbox(failing, 5)).toEqual({ sent: 0, failed: 0 }); // not due yet
        t.setNow(row.nextAttemptAt + 1);
      }
    }
    expect(row.status).toBe("DEAD");
    t.setNow(T.phase2 + 60_000);
  });
});

describe("event day and results", () => {
  test("check-in is limited to confirmed teams", async () => {
    t.setNow(T.eventDay);
    const confirmed = (await t.ctx.db.select().from(participants).where(eq(participants.teamId, teamIds[0])))[0];
    const unconfirmed = (await t.ctx.db.select().from(participants).where(eq(participants.teamId, teamIds[5])))[0];
    await setAttendance(t.ctx, superAdmin, confirmed.id, true);
    await setAttendance(t.ctx, superAdmin, confirmed.id, true);
    expect(await t.ctx.db.select().from(attendance)).toHaveLength(1);
    expect(await code(setAttendance(t.ctx, superAdmin, unconfirmed.id, true))).toBe("INVALID_TRANSITION");
    await setAttendance(t.ctx, superAdmin, confirmed.id, false);
    expect(await t.ctx.db.select().from(attendance)).toHaveLength(0);
  });

  test("nothing is public before publishing; publishing needs a complete podium", async () => {
    // Confirm two more teams so there are four finalists.
    for (const [i, trx] of [[3, "TRX0000030"], [4, "TRX0000040"]] as const) {
      t.setNow(T.phase2 + i * 1000);
      await submitPayment(t.ctx, teamIds[i], pay(trx));
      const p = (await t.ctx.db.select().from(payments).where(eq(payments.teamId, teamIds[i])))[0];
      await verifyPayment(t.ctx, payAdmin, p.id);
    }
    t.setNow(T.eventDay + 60_000);
    expect(await code(saveResult(t.ctx, resultsAdmin, teamIds[9], { totalScore: 50, rank: null, position: null, judgeFeedback: "" }))).toBe("INVALID_TRANSITION");

    await saveResult(t.ctx, resultsAdmin, teamIds[0], { totalScore: 91.5, rank: 1, position: "CHAMPION", judgeFeedback: "SECRET-FEEDBACK-A" });
    await saveResult(t.ctx, resultsAdmin, teamIds[2], { totalScore: 88, rank: 2, position: "FIRST_RUNNER_UP", judgeFeedback: "SECRET-FEEDBACK-B" });
    expect(await code(saveResult(t.ctx, resultsAdmin, teamIds[3], { totalScore: 70, rank: 2, position: null, judgeFeedback: "" }))).toBe("DUPLICATE");
    expect(await code(saveResult(t.ctx, resultsAdmin, teamIds[3], { totalScore: 70, rank: 3, position: "CHAMPION", judgeFeedback: "" }))).toBe("DUPLICATE");

    expect(await getPublicLeaderboard(t.ctx)).toEqual({ published: false });
    expect(await code(publishResults(t.ctx, resultsAdmin))).toBe("VALIDATION_ERROR");

    await saveResult(t.ctx, resultsAdmin, teamIds[3], { totalScore: 95, rank: null, position: null, judgeFeedback: "" });
    await saveResult(t.ctx, resultsAdmin, teamIds[4], { totalScore: 60, rank: null, position: null, judgeFeedback: "" });
    expect(await autoRank(t.ctx, resultsAdmin)).toBe(4);
  });

  test("publish shows the podium with prizes and only public fields; unpublish hides it again", async () => {
    await publishResults(t.ctx, resultsAdmin, { notify: true });
    const board = await getPublicLeaderboard(t.ctx);
    if (!board.published) throw new Error("expected published");
    expect(board.rows.map((r) => [r.rank, r.position, r.prizeBdt, r.totalScore])).toEqual([
      [1, "CHAMPION", 10000, 95],
      [2, "FIRST_RUNNER_UP", 8000, 91.5],
      [3, "SECOND_RUNNER_UP", 7000, 88],
      [4, null, null, 60],
    ]);
    expect(board.rows[0].teamName).toBe((await teamOf(teamIds[3])).name);
    expect(Object.keys(board.rows[0]).sort()).toEqual(["position", "prizeBdt", "projectTitle", "rank", "teamName", "totalScore", "universities"]);

    const body = JSON.stringify(board);
    expect(body).not.toContain("SECRET-FEEDBACK");
    for (const p of await t.ctx.db.select().from(participants)) {
      expect(body).not.toContain(p.email);
      expect(body).not.toContain(p.phone.slice(3));
      expect(body).not.toContain(p.studentId);
    }

    // Edits after publishing stay private until the next publish.
    await saveResult(t.ctx, resultsAdmin, teamIds[4], { totalScore: 61, rank: 4, position: null, judgeFeedback: "" });
    const still = await getPublicLeaderboard(t.ctx);
    expect(still.published && still.rows[3].totalScore).toBe(60);

    const confirmedPeople = (await t.ctx.db.select({ id: participants.id }).from(participants).innerJoin(teams, eq(teams.id, participants.teamId)).where(eq(teams.status, "CONFIRMED"))).length;
    expect((await t.ctx.db.select().from(emailOutbox)).filter((m) => m.template === "results")).toHaveLength(confirmedPeople);

    await unpublishResults(t.ctx, resultsAdmin);
    expect(await getPublicLeaderboard(t.ctx)).toEqual({ published: false });
  });

  test("admin actions were written to the activity log", async () => {
    const actions = new Set((await t.ctx.db.select({ a: adminActivityLogs.action }).from(adminActivityLogs)).map((r) => r.a));
    for (const a of ["review.save", "shortlist.add", "shortlist.override_add", "shortlist.finalise", "payment.verify", "payment.reject", "result.save", "result.publish", "result.unpublish"]) {
      expect(actions).toContain(a);
    }
  });
});
