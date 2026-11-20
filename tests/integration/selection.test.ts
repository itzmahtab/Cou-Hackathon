import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { emailOutbox, teams, type Admin } from "@/lib/db/schema";
import { registerTeam } from "@/features/registration/service";
import { saveReview } from "@/features/reviews/service";
import { setCandidate, setWaitlistPosition } from "@/features/shortlist/service";
import { finalSelection, getSelectionTemplate, saveSelectionTemplate, selectionContext, templateVars } from "@/features/selection/service";
import { DEFAULT_SELECTION_TEMPLATE, fillTemplate } from "@/features/selection/template";
import { buildRegistration, createTestEnv, makeAdmin, T, type TestEnv } from "../helpers";

let t: TestEnv;
let superAdmin: Admin;
const ids: string[] = [];

beforeAll(async () => {
  t = await createTestEnv();
  superAdmin = await makeAdmin(t.ctx, "SUPER_ADMIN");
  for (let i = 0; i < 4; i++) {
    const res = await registerTeam(t.ctx, await buildRegistration(t.ctx, ((i % 3) + 1) as 1 | 2 | 3), "1.1.1.1");
    ids.push((await t.ctx.db.select({ id: teams.id }).from(teams).where(eq(teams.registrationId, res.registrationId)))[0].id);
  }
  t.setNow(T.review);
  for (const [i, id] of ids.entries()) await saveReview(t.ctx, superAdmin, id, { scoreRelevance: 10 + i, scoreInnovation: 20, scoreAi: 20, scoreFeasibility: 10, scoreImpact: 10, notes: "" });
});
afterAll(() => t.dispose());

describe("final selection", () => {
  test("groups selected / waiting / rejected with every member's contacts, best score first", async () => {
    await setCandidate(t.ctx, superAdmin, ids[0], true);
    await setCandidate(t.ctx, superAdmin, ids[3], true);
    await setWaitlistPosition(t.ctx, superAdmin, ids[1], 1);
    await setCandidate(t.ctx, superAdmin, ids[2], true);
    await setCandidate(t.ctx, superAdmin, ids[2], false, undefined);
    // Mark ids[2] as rejected the way the final review does.
    const { shortlistSelections } = await import("@/lib/db/schema");
    await t.ctx.db.insert(shortlistSelections).values({ id: crypto.randomUUID(), teamId: ids[2], action: "REMOVE", justification: "Final review: rejected", adminId: superAdmin.id, createdAt: t.ctx.now() });

    const s = await finalSelection(t.ctx);
    expect(s.selected.map((x) => x.id)).toEqual([ids[3], ids[0]]); // higher score first
    expect(s.waiting.map((x) => [x.id, x.waitlist])).toEqual([[ids[1], 1]]);
    expect(s.rejected.map((x) => x.id)).toEqual([ids[2]]);
    expect(s.others).toBe(0);
    expect(s.selected[1].members).toHaveLength(1);
    expect(s.selected[0].members[0]).toMatchObject({ position: 1, phone: "+8801712345678" });
    expect(s.selected[0].members.every((m) => m.email.includes("@"))).toBe(true);
  });

  test("template: default until saved, validated, and filling it creates no outbox email", async () => {
    expect(await getSelectionTemplate(t.ctx)).toEqual(DEFAULT_SELECTION_TEMPLATE);
    await expect(saveSelectionTemplate(t.ctx, superAdmin, { subject: "", body: "x", telegramLink: "https://t.me/x" })).rejects.toThrow();
    await expect(saveSelectionTemplate(t.ctx, superAdmin, { subject: "S", body: "x", telegramLink: "not a link" })).rejects.toThrow();
    await saveSelectionTemplate(t.ctx, superAdmin, { subject: "Hi {teamName}", body: "Join {telegramLink}", telegramLink: "https://t.me/+i1nLFtZoiLkzYThl" });

    const before = (await t.ctx.db.select().from(emailOutbox)).length;
    const { selected, settings, tpl } = await selectionContext(t.ctx);
    const vars = templateVars(selected[0], settings, tpl);
    expect(fillTemplate(tpl.subject, vars)).toBe(`Hi ${selected[0].name}`);
    expect(fillTemplate(tpl.body, vars)).toBe("Join https://t.me/+i1nLFtZoiLkzYThl");
    expect((await t.ctx.db.select().from(emailOutbox)).length).toBe(before);
  });
});

describe("saved template upgrade", () => {
  test("a template saved with only the old fields gets the new fields from the defaults", async () => {
    await saveSelectionTemplate(t.ctx, superAdmin, { subject: "Old", body: "Old body", telegramLink: "https://t.me/+i1nLFtZoiLkzYThl" });
    const tpl = await getSelectionTemplate(t.ctx);
    expect(tpl).toMatchObject({ subject: "Old", body: "Old body", rulebookLink: DEFAULT_SELECTION_TEMPLATE.rulebookLink, helplineEmail: DEFAULT_SELECTION_TEMPLATE.helplineEmail, headline: DEFAULT_SELECTION_TEMPLATE.headline });
  });
});

describe("send to all selected teams", () => {
  test("queues one email per member of the selected teams only, once; it renders and sends", async () => {
    const { sendSelectionEmails, selectionSendStatus, finalSelection: fs } = await import("@/features/selection/service");
    const { drainOutbox } = await import("@/features/email/outbox");
    const { selected, waiting, rejected } = await fs(t.ctx);
    const expected = selected.reduce((n, x) => n + x.members.length, 0);
    const before = (await t.ctx.db.select().from(emailOutbox)).length;

    const first = await sendSelectionEmails(t.ctx, superAdmin);
    expect(first).toMatchObject({ teams: selected.length, recipients: expected, queued: expected, skipped: 0 });
    const rows = (await t.ctx.db.select().from(emailOutbox)).filter((r) => r.template === "final_selection");
    expect(rows).toHaveLength(expected);
    expect(new Set(rows.map((r) => r.toEmail))).toEqual(new Set(selected.flatMap((x) => x.members.map((m) => m.email))));
    const notSelected = new Set([...waiting, ...rejected].map((x) => x.id));
    expect(rows.some((r) => r.teamId && notSelected.has(r.teamId))).toBe(false);
    const { renderEmail } = await import("@/features/email/templates");
    const row = rows.find((r) => r.teamId === selected[0].id)!;
    const rendered = renderEmail(row.template, JSON.parse(row.payloadJson));
    expect(rendered.html).toContain(selected[0].name);
    expect(rendered.html).toContain(selected[0].members[0].fullName);
    expect(rendered.html).toContain("JOIN TELEGRAM GROUP");

    expect(await sendSelectionEmails(t.ctx, superAdmin)).toMatchObject({ queued: 0, skipped: expected });
    expect((await t.ctx.db.select().from(emailOutbox)).length).toBe(before + expected);

    await drainOutbox(t.ctx, 50);
    const st = await selectionSendStatus(t.ctx);
    expect(st.byStatus.SENT).toBe(expected);
  });
});

describe("design choice reaches Send to all", () => {
  test("a saved Purple design is what the queued emails render", async () => {
    const { renderEmail } = await import("@/features/email/templates");
    const { sendSelectionEmails } = await import("@/features/selection/service");
    await saveSelectionTemplate(t.ctx, superAdmin, { ...DEFAULT_SELECTION_TEMPLATE, design: "classic" });
    expect((await getSelectionTemplate(t.ctx)).design).toBe("classic");
    // A new member address so this send queues fresh rows.
    const { participants } = await import("@/lib/db/schema");
    const { selected } = await finalSelection(t.ctx);
    await t.ctx.db.update(participants).set({ email: "new-member@example.com" }).where(eq(participants.teamId, selected[0].id));
    const res = await sendSelectionEmails(t.ctx, superAdmin);
    expect(res.queued).toBeGreaterThan(0);
    const row = (await t.ctx.db.select().from(emailOutbox)).find((r) => r.template === "final_selection" && r.toEmail === "new-member@example.com")!;
    const out = renderEmail(row.template, JSON.parse(row.payloadJson));
    expect(out.html).toContain("/email/header.jpg");
    expect(out.html).toContain(">Read the rulebook<");
  });
});

describe("payment confirmation per team", () => {
  test("emails one selected team's members once; refuses others; renders; leaves the selection template alone", async () => {
    const { sendPaymentConfirmation, paymentEmailStatus, getTemplate, saveTemplate } = await import("@/features/selection/service");
    const { renderEmail } = await import("@/features/email/templates");
    const { drainOutbox } = await import("@/features/email/outbox");
    const { DEFAULT_PAYMENT_TEMPLATE } = await import("@/features/selection/template");
    const { selected, waiting } = await finalSelection(t.ctx);
    const team = selected[1];

    expect(await getTemplate(t.ctx, "payment")).toEqual(DEFAULT_PAYMENT_TEMPLATE);
    const selBefore = await getSelectionTemplate(t.ctx);
    await saveTemplate(t.ctx, superAdmin, "payment", { ...DEFAULT_PAYMENT_TEMPLATE, headline: "PAID, {teamName}!" });
    expect(await getSelectionTemplate(t.ctx)).toEqual(selBefore);

    const r1 = await sendPaymentConfirmation(t.ctx, superAdmin, team.id);
    expect(r1).toMatchObject({ team: team.name, recipients: team.members.length, queued: team.members.length });
    const rows = (await t.ctx.db.select().from(emailOutbox)).filter((r) => r.template === "payment_confirmation");
    expect(rows.every((r) => r.teamId === team.id)).toBe(true);
    expect(new Set(rows.map((r) => r.toEmail))).toEqual(new Set(team.members.map((m) => m.email)));
    expect(renderEmail(rows[0].template, JSON.parse(rows[0].payloadJson)).html).toContain(`PAID, ${team.name}!`);

    expect((await sendPaymentConfirmation(t.ctx, superAdmin, team.id)).queued).toBe(0);
    await expect(sendPaymentConfirmation(t.ctx, superAdmin, waiting[0].id)).rejects.toThrow(/not on the final selection/);

    await drainOutbox(t.ctx, 50);
    expect((await paymentEmailStatus(t.ctx))[team.id]).toMatchObject({ sent: team.members.length, queued: 0, failed: 0 });
  });
});

describe("waiting list: select & send selection email", () => {
  test("promotes the team (override when full), emails only its members once, refuses repeats", async () => {
    const { selectFromWaitlistAndEmail, sendSelectionEmails, WAITLIST_PROMOTION_NOTE } = await import("@/features/selection/service");
    const { settingsUpserts } = await import("@/lib/settings");
    const { shortlistSelections } = await import("@/lib/db/schema");
    const before = await finalSelection(t.ctx);
    const team = before.waiting[0];
    expect(team).toBeDefined();
    // Make the list full so the promotion has to be an override.
    await t.ctx.db.batch(settingsUpserts(t.ctx, { shortlistCapacity: before.selected.length }, superAdmin.id) as never);

    const outboxBefore = (await t.ctx.db.select().from(emailOutbox)).length;
    const res = await selectFromWaitlistAndEmail(t.ctx, superAdmin, team.id);
    expect(res).toMatchObject({ team: team.name, recipients: team.members.length, queued: team.members.length });

    const after = await finalSelection(t.ctx);
    expect(after.selected.map((x) => x.id)).toContain(team.id);
    expect(after.waiting.map((x) => x.id)).not.toContain(team.id);
    const log = (await t.ctx.db.select().from(shortlistSelections)).filter((r) => r.teamId === team.id).at(-1)!;
    expect(log).toMatchObject({ action: "OVERRIDE_ADD", justification: WAITLIST_PROMOTION_NOTE });

    const rows = (await t.ctx.db.select().from(emailOutbox)).slice(outboxBefore);
    expect(rows.every((r) => r.template === "final_selection" && r.teamId === team.id)).toBe(true);
    expect(new Set(rows.map((r) => r.toEmail))).toEqual(new Set(team.members.map((m) => m.email)));

    await expect(selectFromWaitlistAndEmail(t.ctx, superAdmin, team.id)).rejects.toThrow(/not on the waiting list/);
    await expect(selectFromWaitlistAndEmail(t.ctx, superAdmin, after.selected[0].id)).rejects.toThrow(/not on the waiting list/);
    // Send to all afterwards does not email this team again.
    const outboxMid = (await t.ctx.db.select().from(emailOutbox)).filter((r) => r.teamId === team.id).length;
    await sendSelectionEmails(t.ctx, superAdmin);
    expect((await t.ctx.db.select().from(emailOutbox)).filter((r) => r.teamId === team.id).length).toBe(outboxMid);
  });
});

describe("remove from final selection", () => {
  test("a selected or a waiting team moves to Rejected; nothing is emailed", async () => {
    const { removeFromFinalSelection, finalSelection: fs } = await import("@/features/selection/service");
    const { setWaitlistPosition } = await import("@/features/shortlist/service");
    const before = await fs(t.ctx);
    const outbox = (await t.ctx.db.select().from(emailOutbox)).length;
    const sel = before.selected[0];
    await removeFromFinalSelection(t.ctx, superAdmin, sel.id);
    let now = await fs(t.ctx);
    expect(now.selected.map((x) => x.id)).not.toContain(sel.id);
    expect(now.rejected.map((x) => x.id)).toContain(sel.id);

    // Put it back on the waitlist, then remove it from there.
    await setWaitlistPosition(t.ctx, superAdmin, sel.id, 1);
    expect((await fs(t.ctx)).waiting.map((x) => x.id)).toContain(sel.id);
    await removeFromFinalSelection(t.ctx, superAdmin, sel.id);
    now = await fs(t.ctx);
    expect(now.waiting.map((x) => x.id)).not.toContain(sel.id);
    expect(now.rejected.map((x) => x.id)).toContain(sel.id);

    await expect(removeFromFinalSelection(t.ctx, superAdmin, sel.id)).rejects.toThrow(/not selected or waiting/);
    expect((await t.ctx.db.select().from(emailOutbox)).length).toBe(outbox);
  });
});
