// Workflow A: a team of three registers on a phone-sized screen, then the same
// submission is checked for duplicate protection. Run against a live server:
//   BASE_URL=http://localhost:3000 node tests/e2e/workflow-a.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const { chromium, devices } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const fx = (f) => fileURLToPath(new URL(`./fixtures/${f}`, import.meta.url));
const run = Date.now().toString(36);

const browser = await chromium.launch();
const page = await browser.newPage({ ...devices["Pixel 7"] });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`${BASE}/register`);
await page.getByLabel("Team name").fill(`E2E Team ${run}`);
await page.getByText("Trio").click();
await page.getByRole("button", { name: "Continue" }).click();

// Step 2: validation blocks an empty form.
await page.getByRole("button", { name: "Continue" }).click();
await page.getByText("Some fields need attention").waitFor();

for (let i = 0; i < 3; i++) {
  const box = page.locator("fieldset").filter({ hasText: `Participant ${i + 1}` });
  await box.getByRole("textbox", { name: "Full name" }).fill(`Member ${i + 1} ${run}`);
  await box.getByRole("textbox", { name: "Email address" }).fill(`m${i}-${run}@example.com`);
  await box.getByRole("textbox", { name: "Phone number" }).fill(`0171234567${i}`);
  await box.getByLabel("University").fill(i === 2 ? "Dhaka University" : "Comilla University");
  await box.getByLabel("Student ID / registration number").fill(`E2E-${run}-${i}`);
  await box.getByLabel("T-shirt size").selectOption("L");
  // A disguised executable is refused by the server before the real image is accepted.
  if (i === 0) {
    await box.locator('input[type="file"]').setInputFiles(fx("evil.pdf"));
    await box.getByText(/not accepted/).waitFor();
  }
  await box.locator('input[type="file"]').setInputFiles(fx("id.png"));
  await box.getByText("Uploaded").waitFor();
}
await page.getByRole("button", { name: "Continue" }).click();

const long = "This is a detailed answer that comfortably exceeds the fifty character minimum required by the form.";
await page.getByLabel("Project / idea title").fill(`Flood early warning ${run}`);
for (const label of ["Problem statement", "Proposed solution", "AI component / technologies", "Expected impact"]) await page.getByLabel(label).fill(long);
await page.getByLabel("Idea document").setInputFiles(fx("idea.pdf"));
await page.getByText("Document uploaded").or(page.getByText("idea.pdf")).first().waitFor();
await page.getByRole("button", { name: "Continue" }).click();

// Step 4: review shows everything, and consents are required.
await page.getByText(`Member 3 ${run}`).waitFor();
await page.getByRole("button", { name: "Submit registration" }).click();
await page.getByText("You must agree to the event rules.").waitFor();
for (const cb of await page.getByRole("checkbox").all()) await cb.check();

// Draft survives a reload.
await page.reload();
await page.getByText(`Member 3 ${run}`).waitFor();
for (const cb of await page.getByRole("checkbox").all()) await cb.check();

// Double-click submit: exactly one registration.
const submit = page.getByRole("button", { name: "Submit registration" });
await submit.dblclick();
const id = (await page.getByTestId("registration-id").textContent()).trim();
assert.match(id, /^COU26-[0-9A-HJKMNP-TV-Z]{6}$/);
console.log("registered", id);

// The same people cannot register again.
const again = await page.request.post(`${BASE}/api/v1/registrations`, {
  headers: { origin: BASE },
  data: { idempotencyKey: crypto.randomUUID(), uploadSession: crypto.randomUUID(), team: { name: `E2E Team ${run}`, size: 1 }, participants: [{ fullName: "X Y", email: `m0-${run}@example.com`, phone: "01712345670", whatsapp: "01712345670", university: "Comilla University", studentId: `E2E-${run}-0`, tshirtSize: "L", idCardFileId: crypto.randomUUID() }], idea: { title: "Duplicate idea", problemStatement: long, proposedSolution: long, aiComponent: long, expectedImpact: long, documentFileId: crypto.randomUUID() }, consents: { rules: true, accuracy: true, communications: true } },
});
assert.equal(again.status(), 409);
const body = await again.json();
assert.ok(body.error.fields["team.name"] && body.error.fields["participants.0.email"] && body.error.fields["participants.0.studentId"]);

// A foreign origin is refused.
const foreign = await page.request.post(`${BASE}/api/v1/registrations`, { headers: { origin: "https://evil.example" }, data: {} });
assert.equal(foreign.status(), 403);

assert.deepEqual(errors, []);
await browser.close();
console.log(JSON.stringify({ ok: true, registrationId: id }));
