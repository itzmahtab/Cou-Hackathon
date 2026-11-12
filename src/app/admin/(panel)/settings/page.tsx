import { asc } from "drizzle-orm";
import { createAdminAction, purgeIdentityFilesAction, resetAdminPasswordAction, saveSettingsAction, saveSmtpPasswordAction, updateAdminAction } from "@/app/admin/actions/settings";
import { smtpPasswordSource } from "@/features/email/config";
import { ActionForm } from "@/components/admin/action-form";
import { AdminHeader, Section } from "@/components/admin/ui";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { ADMIN_ROLES } from "@/lib/constants";
import { admins } from "@/lib/db/schema";
import { requireAdminPage } from "@/lib/server";
import { getSettings } from "@/lib/settings";
import { formatDhaka } from "@/lib/time";

export const metadata = { title: "Settings" };

/** ISO timestamp -> value for a datetime-local input, in Bangladesh time. */
const local = (iso: string) => new Date(Date.parse(iso) + 6 * 3600 * 1000).toISOString().slice(0, 16);

export default async function SettingsPage() {
  const { ctx, admin } = await requireAdminPage("settings.manage");
  const [s, people, smtpSource] = await Promise.all([getSettings(ctx), ctx.db.select().from(admins).orderBy(asc(admins.createdAt)), smtpPasswordSource(ctx)]);
  const text = (name: string, label: string, value: string | number, extra: Record<string, unknown> = {}) => (
    <label className="text-sm">
      <span className="field-label">{label}</span>
      <input name={name} defaultValue={value} className="input" {...extra} />
    </label>
  );

  return (
    <>
      <AdminHeader title="Settings" lead="Changes apply to the public site immediately. All times are Bangladesh time (UTC+6)." />
      <div className="grid gap-6">
        <Section title="Event">
          <ActionForm action={saveSettingsAction} submitLabel="Save settings">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {text("phase1OpenAt", "Phase 1 opens", local(s.phase1OpenAt), { type: "datetime-local", required: true })}
              {text("phase1CloseAt", "Phase 1 closes", local(s.phase1CloseAt), { type: "datetime-local", required: true })}
              {text("shortlistAnnouncement", "Shortlist announcement (text)", s.shortlistAnnouncement, { required: true })}
              {text("phase2OpenAt", "Phase 2 (payment) opens", local(s.phase2OpenAt), { type: "datetime-local", required: true })}
              {text("phase2CloseAt", "Phase 2 (payment) closes", local(s.phase2CloseAt), { type: "datetime-local", required: true })}
              {text("eventStartAt", "Hackathon starts", local(s.eventStartAt), { type: "datetime-local", required: true })}
              {text("venue", "Venue", s.venue, { required: true })}
              {text("feeBdt", "Team fee (BDT)", s.feeBdt, { type: "number", min: 0, required: true })}
              {text("shortlistCapacity", "Shortlist size", s.shortlistCapacity, { type: "number", min: 1, required: true })}
              {text("bkashNumber", "bKash receiving number (Send Money)", s.bkashNumber, { placeholder: "01XXXXXXXXX" })}
              {text("nagadNumber", "Nagad receiving number (Send Money)", s.nagadNumber, { placeholder: "01XXXXXXXXX" })}
              {text("contactEmail", "Contact email", s.contactEmail, { type: "email" })}
              {text("contactPhone", "Contact phone", s.contactPhone)}
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="screenshotRequired" defaultChecked={s.screenshotRequired} className="h-4 w-4 accent-[#8b5cf6]" /> Payment screenshot required
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="allowResubmission" defaultChecked={s.allowResubmission} className="h-4 w-4 accent-[#8b5cf6]" /> Allow resubmission after a rejected payment
              </label>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="text-sm">
                <span className="field-label">Problem domains, one per line: Title | description</span>
                <textarea name="domains" rows={7} defaultValue={s.domains.map((d) => `${d.title} | ${d.description}`).join("\n")} className="input font-mono text-xs" />
              </label>
              <label className="text-sm">
                <span className="field-label">Organising team, one per line: Name | role</span>
                <textarea name="organisers" rows={7} defaultValue={s.organisers.map((o) => `${o.name} | ${o.role}`).join("\n")} className="input font-mono text-xs" />
              </label>
            </div>
          </ActionForm>
        </Section>

        <Section title="Email (Gmail)">
          <p className="text-sm text-muted">
            Emails are sent from <strong className="text-fg">{ctx.env.SMTP_USER ?? "—"}</strong> through Gmail using Nodemailer. Status:{" "}
            {smtpSource ? (
              <span className="badge badge-success">Password set{smtpSource === "secret" ? " (Cloudflare secret)" : ""}</span>
            ) : (
              <span className="badge badge-danger">No password: emails are waiting in the queue</span>
            )}
          </p>
          <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-muted">
            <li>
              Signed in to that Gmail account, turn on 2-Step Verification at{" "}
              <a className="text-primary-soft underline" href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer">
                myaccount.google.com/security
              </a>
              .
            </li>
            <li>
              Create an App Password at{" "}
              <a className="text-primary-soft underline" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">
                myaccount.google.com/apppasswords
              </a>{" "}
              and paste the 16 characters below. Your normal Gmail password will not work.
            </li>
          </ol>
          {smtpSource !== "secret" && (
            <ActionForm action={saveSmtpPasswordAction} submitLabel="Save and send queued emails" className="mt-4" resetOnSuccess>
              <input name="smtpPassword" type="password" autoComplete="off" placeholder="abcd efgh ijkl mnop" aria-label="Gmail App Password" required className="input max-w-sm font-mono" />
            </ActionForm>
          )}
          {smtpSource === "settings" && (
            <ActionForm action={saveSmtpPasswordAction} submitLabel="Remove saved password" submitClass="btn-ghost" confirm="Remove the saved Gmail App Password? Emails will stop sending." className="mt-2">
              <input type="hidden" name="clear" value="1" />
            </ActionForm>
          )}
        </Section>

        <Section title="Admin accounts">
          <ul className="grid gap-3">
            {people.map((p) => (
              <li key={p.id} className="rounded-xl border border-line p-4 text-sm">
                <p className="font-semibold">
                  {p.name} <span className="font-normal text-muted">· {p.email}</span> {!p.isActive && <span className="badge badge-danger ml-1">Disabled</span>}
                  {p.id === admin.id && <span className="badge badge-primary ml-1">You</span>}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {ROLE_LABELS[p.role]} · last sign-in {p.lastLoginAt ? formatDhaka(p.lastLoginAt) : "never"}
                </p>
                {p.id !== admin.id && (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <ActionForm action={updateAdminAction} submitLabel="Update" submitClass="btn-secondary" inline>
                      <input type="hidden" name="id" value={p.id} />
                      <select name="role" defaultValue={p.role} aria-label="Role" className="input w-auto">
                        {ADMIN_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name="active" defaultChecked={p.isActive} className="h-4 w-4 accent-[#8b5cf6]" /> Active
                      </label>
                    </ActionForm>
                    <ActionForm action={resetAdminPasswordAction} submitLabel="Set temporary password" submitClass="btn-ghost" inline resetOnSuccess>
                      <input type="hidden" name="id" value={p.id} />
                      <input name="password" type="password" autoComplete="new-password" placeholder="Temporary password (12+)" aria-label="Temporary password" minLength={12} required className="input w-56" />
                    </ActionForm>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <details className="mt-5">
            <summary className="cursor-pointer text-sm text-primary-soft">Add an admin</summary>
            <ActionForm action={createAdminAction} submitLabel="Create account" className="mt-4" resetOnSuccess>
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="name" placeholder="Name" aria-label="Name" required className="input" />
                <input name="email" type="email" placeholder="Email" aria-label="Email" required className="input" />
                <select name="role" defaultValue="REVIEWER" aria-label="Role" className="input">
                  {ADMIN_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
                <input name="password" type="password" autoComplete="new-password" placeholder="Temporary password (12+ characters)" aria-label="Temporary password" minLength={12} required className="input" />
              </div>
            </ActionForm>
          </details>
        </Section>

        <Section title="Data retention" className="border-danger/30">
          <p className="mb-4 text-sm text-muted">The privacy policy promises to delete student ID images and payment screenshots 30 days after the event. This removes them permanently from storage. Team, idea and result records are kept.</p>
          <ActionForm action={purgeIdentityFilesAction} submitLabel="Delete ID images and payment screenshots" submitClass="btn-danger" confirm="Permanently delete every student ID image and payment screenshot?" confirmPhrase="PURGE">
            <input type="hidden" name="confirm" value="PURGE" />
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
