// Workflows B, C and D in a real browser, against a FRESH local database that
// has one super admin (see TESTING.md). Finalising the shortlist is one-shot,
// so this test cannot be rerun on the same database.
//   BASE_URL=http://localhost:3000 ADMIN_EMAIL=… ADMIN_PASSWORD=… SESSION_SECRET=… node tests/e2e/workflow-bcd.mjs
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const fx = (f) => readFileSync(fileURLToPath(new URL(`./fixtures/${f}`, import.meta.url)));
const run = Date.now().toString(36);
const long = "This is a detailed answer that comfortably exceeds the fifty character minimum required by the form.";
const step = (s) => console.log(`· ${s}`);

const browser = await chromium.launch();
const admin = await browser.newPage({ viewport: { width: 1360, height: 900 } });
const errors = [];
admin.on("pageerror", (e) => errors.push(String(e)));
admin.on("dialog", (d) => (d.type() === "prompt" ? d.accept(d.message().match(/Type (\w+)/)?.[1]) : d.accept()));

// --- Three teams register through the public API (uploads included). ---
const api = admin.request;
const teams = [];
for (let t = 0; t < 4; t++) {
  const uploadSession = crypto.randomUUID();
  const upload = async (category, name, mimeType) => {
    const res = await api.post(`${BASE}/api/v1/uploads`, { headers: { origin: BASE }, multipart: { category, uploadSession, file: { name, mimeType, buffer: fx(name) } } });
    assert.equal(res.status(), 201, await res.text());
    return (await res.json()).data.fileId;
  };
  const email = `lead${t}-${run}@example.com`;
  const res = await api.post(`${BASE}/api/v1/registrations`, {
    headers: { origin: BASE },
    data: {
      idempotencyKey: crypto.randomUUID(),
      uploadSession,
      team: { name: `BCD ${t} ${run}`, size: 1 },
      participants: [{ fullName: `Leader ${t}`, email, phone: "01712345678", whatsapp: "01712345678", university: "Comilla University", studentId: `BCD-${run}-${t}`, tshirtSize: "M", idCardFileId: await upload("STUDENT_ID", "id.png", "image/png") }],
      idea: { title: `Idea ${t} ${run}`, problemStatement: long, proposedSolution: long, aiComponent: long, expectedImpact: long, documentFileId: await upload("IDEA_DOC", "idea.pdf", "application/pdf") },
      consents: { rules: true, accuracy: true, communications: true },
    },
  });
  assert.equal(res.status(), 201, await res.text());
  teams.push({ ...(await res.json()).data, email, name: `BCD ${t} ${run}` });
}
step("4 teams registered");

// --- Unauthenticated access is refused. ---
await admin.goto(`${BASE}/admin/payments`);
assert.match(admin.url(), /\/admin\/login/);
assert.equal((await api.get(`${BASE}/api/v1/admin/export/registrations`)).status(), 401);
step("admin pages and exports refuse anonymous visitors");

// --- Sign in. ---
await admin.getByLabel("Email").fill(process.env.ADMIN_EMAIL);
await admin.getByLabel("Password").fill(process.env.ADMIN_PASSWORD);
await admin.getByRole("button", { name: "Sign in" }).click();
await admin.waitForURL(`${BASE}/admin`);
step("signed in");

for (const path of ["/admin", "/admin/registrations", "/admin/reviews", "/admin/shortlist", "/admin/payments", "/admin/participants", "/admin/event", "/admin/results", "/admin/emails", "/admin/logs", "/admin/settings", "/admin/account"]) {
  const res = await admin.goto(`${BASE}${path}`);
  assert.equal(res.status(), 200, path);
  await admin.locator("h1").first().waitFor();
}
step("every admin page renders");

// --- Workflow B: review all three, shortlist two, finalise. ---
await admin.goto(`${BASE}/admin/reviews`);
for (let t = 0; t < 4; t++) {
  await admin.goto(`${BASE}/admin/reviews`);
  await admin.getByRole("link", { name: `Idea ${t} ${run}` }).click();
  const scores = [[18, 22, 23, 12, 13], [15, 20, 20, 10, 10], [14, 18, 18, 9, 9], [5, 5, 5, 5, 5]][t];
  for (const [i, label] of ["Problem relevance", "Innovation", "AI application", "Feasibility", "Potential impact"].entries()) {
    await admin.getByRole("spinbutton", { name: label }).fill(String(scores[i]));
  }
  await admin.getByRole("button", { name: "Save review" }).click();
  await admin.getByText(/Saved\. Your total/).waitFor();
}
step("ideas scored");

await admin.goto(`${BASE}/admin/shortlist`);
for (const t of [0, 1, 2]) {
  await admin.getByRole("row").filter({ hasText: `Idea ${t} ${run}` }).getByRole("button", { name: "Select" }).click();
  await admin.getByRole("row").filter({ hasText: `Idea ${t} ${run}` }).getByRole("button", { name: "Remove" }).waitFor();
}
await admin.getByRole("button", { name: /Finalise 3 teams/ }).click();
await admin.getByText(/^Finalised .*Selection emails have been queued/).waitFor();
assert.equal(await admin.getByRole("row").filter({ hasText: "Shortlisted" }).count(), 3);
step("shortlist finalised with 3 teams");

// --- Open Phase 2 now through the settings page. ---
await admin.goto(`${BASE}/admin/settings`);
const dhakaLocal = (ms) => new Date(ms + 6 * 3600e3).toISOString().slice(0, 16);
await admin.locator('input[name="phase2OpenAt"]').fill(dhakaLocal(Date.now() - 3600e3));
await admin.locator('input[name="phase2CloseAt"]').fill(dhakaLocal(Date.now() + 86400e3));
await admin.locator('input[name="bkashNumber"]').fill("01700000000");
await admin.getByRole("button", { name: "Save settings" }).click();
await admin.getByText("Settings saved").waitFor();
step("payment window opened from settings");

// --- Workflow C: shortlisted teams pay from their personal status link. ---
const secret = process.env.SESSION_SECRET;
const statusLink = async (t) => {
  await admin.goto(`${BASE}/admin/registrations?q=${teams[t].registrationId}`);
  await admin.getByRole("link", { name: teams[t].name }).click();
  const pid = await admin.locator('input[name="participantId"]').first().inputValue();
  const sig = createHmac("sha256", secret).update(`status:${pid}`).digest("hex").slice(0, 40);
  return `${BASE}/status/open?p=${pid}&s=${sig}`;
};
const openStatus = async (t) => {
  const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(await statusLink(t));
  await page.getByTestId("stage-badge").waitFor();
  return page;
};

const loser = await openStatus(3);
assert.equal(await loser.getByTestId("stage-badge").textContent(), "Not selected");
assert.equal(await loser.getByRole("button", { name: "Submit payment details" }).count(), 0);
const forged = await browser.newPage();
await forged.goto(`${BASE}/status/open?p=00000000-0000-4000-8000-000000000000&s=${"0".repeat(40)}`);
await forged.getByText("That link is not valid").waitFor();
step("non-selected team sees its result; a forged link is refused");

const pay = async (page, trx) => {
  await page.getByRole("textbox", { name: "Sender number" }).fill("01811111111");
  await page.getByRole("textbox", { name: "Transaction ID" }).fill(trx);
  await page.getByRole("button", { name: "Submit payment details" }).click();
};
const trx = (k) => `TRX${k}${run}`.toUpperCase();
for (const t of [0, 1, 2]) {
  const page = await openStatus(t);
  assert.equal(await page.getByTestId("stage-badge").textContent(), "Payment pending");
  await pay(page, trx(t));
  await page.getByText("Verifying payment").waitFor();
  teams[t].visitor = page;
}
step("3 payments submitted from status pages");

await admin.goto(`${BASE}/admin/payments`);
const card = (name) => admin.getByRole("listitem").filter({ hasText: name });
await card(teams[1].name).getByPlaceholder("Reason shown to the team").fill("Transaction not found on the statement");
await card(teams[1].name).getByRole("button", { name: "Reject" }).click();
// A decided payment leaves the pending queue.
await card(teams[1].name).waitFor({ state: "detached" });
for (const t of [0, 2]) {
  await card(teams[t].name).getByRole("button", { name: "Verify payment" }).click();
  await card(teams[t].name).waitFor({ state: "detached" });
}
step("two payments verified, one rejected");

await teams[0].visitor.reload();
assert.equal(await teams[0].visitor.getByTestId("stage-badge").textContent(), "Confirmed");
await teams[0].visitor.getByText("Team pass").waitFor();
await teams[1].visitor.reload();
await teams[1].visitor.getByText("Transaction not found on the statement").waitFor();
// The rejected team resubmits; reusing another team's transaction ID is refused.
await pay(teams[1].visitor, trx(0));
await teams[1].visitor.getByText("already been used").first().waitFor();
await teams[1].visitor.getByRole("textbox", { name: "Transaction ID" }).fill(trx(9));
await teams[1].visitor.getByRole("button", { name: "Submit payment details" }).click();
await teams[1].visitor.getByText("Verifying payment").waitFor();
await admin.goto(`${BASE}/admin/payments`);
await card(teams[1].name).getByRole("button", { name: "Verify payment" }).click();
await card(teams[1].name).waitFor({ state: "detached" });
await admin.goto(`${BASE}/admin/payments?status=VERIFIED`);
assert.equal(await admin.getByRole("listitem").filter({ hasText: run }).count(), 3);
step("rejected team resubmitted (duplicate ID refused) and was verified");

// --- Event day: check-in from the QR target URL. ---
await admin.goto(`${BASE}/admin/event?q=${teams[0].registrationId}`);
await admin.getByRole("button", { name: "Check in" }).first().click();
await admin.getByText("1/1 present").waitFor();
step("checked in from the team pass search");

// --- Workflow D: results. ---
await admin.goto(`${BASE}/admin/results`);
const row = (name) => admin.getByRole("row").filter({ hasText: name });
for (const [t, score] of [[0, "91.5"], [1, "84"], [2, "88"]]) {
  await row(teams[t].name).getByRole("spinbutton").first().fill(score);
  await row(teams[t].name).getByLabel(/Feedback/).fill(`SECRET-FEEDBACK-${t}`);
  await row(teams[t].name).getByRole("button", { name: "Save" }).click();
  await row(teams[t].name).getByText("Saved (not yet public)").waitFor();
}
let lb = await (await api.get(`${BASE}/api/v1/leaderboard`)).json();
assert.deepEqual(lb.data, { published: false });
await admin.getByRole("button", { name: "Publish results" }).click();
await admin.getByText(/Assign Champion, First Runner-up and Second Runner-up/).waitFor();
step("publishing is refused before prizes are assigned");

await admin.getByRole("button", { name: "Rank automatically by score" }).click();
await admin.getByText(/Ranked 3 teams/).waitFor();
await admin.getByRole("button", { name: "Publish results" }).click();
await admin.getByText(/Published 3 results/).waitFor();
lb = await (await api.get(`${BASE}/api/v1/leaderboard`)).json();
assert.deepEqual(lb.data.rows.map((r) => [r.rank, r.teamName, r.prizeBdt]), [[1, teams[0].name, 10000], [2, teams[2].name, 8000], [3, teams[1].name, 7000]]);
const publicHtml = await (await api.get(`${BASE}/leaderboard`)).text();
assert.ok(publicHtml.includes(teams[0].name) && publicHtml.includes("Champion"));
for (const leak of ["SECRET-FEEDBACK", teams[0].email, "BCD-"]) {
  assert.ok(!JSON.stringify(lb).includes(leak) && !publicHtml.includes(leak), `public output leaked ${leak}`);
}
const visitor = await browser.newPage({ viewport: { width: 412, height: 900 } });
await visitor.goto(`${BASE}/leaderboard`);
await visitor.getByRole("list", { name: "Winners" }).getByText(teams[0].name).waitFor();
step("results published: podium correct, no private data in public output");

await admin.getByRole("button", { name: "Unpublish" }).click();
await admin.getByText(/The leaderboard is not public yet/).waitFor();
lb = await (await api.get(`${BASE}/api/v1/leaderboard`)).json();
assert.deepEqual(lb.data, { published: false });
step("unpublished");

// --- Role boundaries: a reviewer cannot reach payments or exports. ---
await admin.goto(`${BASE}/admin/settings`);
await admin.getByText("Add an admin").click();
await admin.getByPlaceholder("Name").fill("Test Reviewer");
await admin.getByPlaceholder("Email").fill(`rev-${run}@local.test`);
await admin.locator('select[name="role"]').last().selectOption("REVIEWER");
await admin.getByPlaceholder("Temporary password (12+ characters)").fill("reviewer-temp-pass-1");
await admin.getByRole("button", { name: "Create account" }).click();
await admin.getByText(/Created rev-/).waitFor();
const rev = await (await browser.newContext()).newPage();
await rev.goto(`${BASE}/admin/login`);
await rev.getByLabel("Email").fill(`rev-${run}@local.test`);
await rev.getByLabel("Password").fill("reviewer-temp-pass-1");
await rev.getByRole("button", { name: "Sign in" }).click();
await rev.waitForURL(/\/admin\/account/);
await rev.locator('input[name="current"]').fill("reviewer-temp-pass-1");
await rev.locator('input[name="next"]').fill("reviewer-new-pass-22");
await rev.locator('input[name="repeat"]').fill("reviewer-new-pass-22");
await rev.getByRole("button", { name: "Change password" }).click();
await rev.getByText("Password changed").waitFor();
await rev.goto(`${BASE}/admin/payments`);
assert.match(rev.url(), /\/admin\/forbidden/);
assert.equal((await rev.request.get(`${BASE}/api/v1/admin/export/registrations`)).status(), 403);
await rev.goto(`${BASE}/admin/reviews`);
await rev.locator("h1").waitFor();
step("reviewer: forced password change, no access to payments or exports");

assert.deepEqual(errors, []);
await browser.close();
console.log(JSON.stringify({ ok: true }));
