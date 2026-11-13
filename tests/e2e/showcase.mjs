// Project Showcase: a team of two registers in a mobile browser, then an admin finds
// it in the admin panel and verifies the payment. Needs the registration window open.
//   BASE_URL=… ADMIN_EMAIL=… ADMIN_PASSWORD=… node tests/e2e/showcase.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const { chromium, devices } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const run = Date.now().toString(36);
const b = await chromium.launch();
const errors = [];

// Public registration.
const p = await b.newPage({ ...devices["Pixel 7"] });
p.on("pageerror", (e) => errors.push(String(e)));
await p.goto(`${BASE}/showcase`);
await p.getByRole("link", { name: /Register for the showcase/ }).first().click();
await p.waitForURL(/\/showcase\/register/);
await p.getByText("2", { exact: true }).click();
await p.getByRole("button", { name: /Register and submit payment \(BDT 100\)/ }).click();
await p.getByText("Some fields need attention.").waitFor();
for (let i = 0; i < 2; i++) {
  const box = p.locator("fieldset").filter({ hasText: `Member ${i + 1}` });
  await box.getByRole("textbox", { name: "Full name" }).fill(`Showcase ${run} ${i + 1}`);
  await box.getByRole("textbox", { name: "Student ID" }).fill(`SC-${run}-${i}`);
  await box.getByRole("textbox", { name: "Department" }).fill("CSE");
  await box.getByRole("textbox", { name: "Session" }).fill("2021-22");
  await box.getByRole("textbox", { name: "Phone" }).fill(`0171234567${i}`);
  await box.getByRole("textbox", { name: "Email" }).fill(`sc${i}-${run}@example.com`);
}
await p.getByLabel("Project title").fill(`Campus robot ${run}`);
await p.getByLabel("Category").selectOption("Robotics & Automation");
await p.getByLabel("Short description").fill("A line-following robot that delivers documents between faculty offices.");
await p.getByRole("textbox", { name: "bKash number you paid from" }).fill("01811111111");
const trx = `SC${run}`.toUpperCase();
await p.getByRole("textbox", { name: "bKash transaction ID" }).fill(trx);
for (const cb of await p.getByRole("checkbox").all()) await cb.check();
await p.getByRole("button", { name: /Register and submit payment/ }).dblclick();
const regId = (await p.getByTestId("showcase-id").textContent()).trim();
assert.match(regId, /^SHOW26-/);
console.log("· registered", regId);

// Admin verification.
const a = await b.newPage({ viewport: { width: 1360, height: 900 } });
a.on("pageerror", (e) => errors.push(String(e)));
a.on("dialog", (d) => d.accept());
await a.goto(`${BASE}/admin/login`);
await a.getByLabel("Email").fill(process.env.ADMIN_EMAIL);
await a.getByLabel("Password").fill(process.env.ADMIN_PASSWORD);
await a.getByRole("button", { name: "Sign in" }).click();
await a.waitForURL(/\/admin$/);
await a.getByRole("link", { name: "Project Showcase" }).click();
await a.getByPlaceholder(/Name, student ID/).fill(regId);
await a.getByRole("button", { name: "Apply" }).click();
const card = a.getByRole("listitem").filter({ hasText: regId });
await card.getByText(trx).waitFor();
assert.equal(await card.getByRole("row").count(), 3); // header + 2 members
await card.getByRole("button", { name: "Verify payment" }).click();
await card.getByText("Verified. The team has been emailed.").or(card.getByText("Verified", { exact: true })).first().waitFor();
await a.reload();
await card.getByText("Verified", { exact: true }).waitFor();
console.log("· verified in the admin panel");

// The same transaction ID cannot be reused.
const again = await p.request.post(`${BASE}/api/v1/showcase`, {
  headers: { origin: BASE },
  data: { idempotencyKey: crypto.randomUUID(), teamSize: 1, members: [{ fullName: "Other Person", studentId: `X-${run}`, department: "EEE", session: "2022-23", email: `x-${run}@example.com`, phone: "01712345679" }], project: { title: "Another project", category: "Research & Innovation", description: "Another description that is long enough to pass." }, payment: { senderPhone: "01811111111", transactionId: trx }, consents: { student: true, accuracy: true } },
});
assert.equal(again.status(), 409);
console.log("· reused transaction ID refused");

assert.deepEqual(errors, []);
await b.close();
console.log(JSON.stringify({ ok: true, registrationId: regId }));
