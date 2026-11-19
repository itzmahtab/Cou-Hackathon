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
