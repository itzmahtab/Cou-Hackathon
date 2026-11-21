import { and, desc, eq, like, sql, type SQL } from "drizzle-orm";
import { drainNowAction, resendEmailAction, setEmailEnabledAction, testEmailAction } from "@/app/admin/actions/results";
import { savePaymentTemplateAction, saveSelectionTemplateAction, sendPaymentConfirmationAction, sendSelectionEmailsAction } from "@/app/admin/actions/selection";
import { ActionForm } from "@/components/admin/action-form";
import { SelectionTemplateEditor } from "@/components/admin/selection-template-editor";
import { WaitlistSelectButton } from "@/components/admin/waitlist-select-button";
import { getTemplate, paymentEmailStatus, selectionContext, selectionSendStatus, templateVars } from "@/features/selection/service";
import { DEFAULT_PAYMENT_TEMPLATE } from "@/features/selection/template";
import { can } from "@/lib/auth/permissions";
import { AdminHeader, Empty, Section, StatusBadge } from "@/components/admin/ui";
import { smtpPasswordSource } from "@/features/email/config";
import { CANCELLED_NOTE, isEmailEnabled } from "@/features/email/switch";
import { TEMPLATE_LABELS, type TemplateName } from "@/features/email/templates";
import { EMAIL_STATUSES } from "@/lib/constants";
import { emailOutbox, teams } from "@/lib/db/schema";
import { requireAdminPage } from "@/lib/server";
import { formatDhaka } from "@/lib/time";

export const metadata = { title: "Emails" };

export default async function Emails({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, admin } = await requireAdminPage("emails.manage");
  const sp = await searchParams;
  const where: SQL[] = [];
  if (sp.status) where.push(eq(emailOutbox.status, sp.status as never));
  if (sp.template) where.push(eq(emailOutbox.template, sp.template));
  if (sp.q?.trim()) where.push(like(emailOutbox.toEmail, `%${sp.q.trim().toLowerCase().replace(/[%_]/g, "")}%`));
  const [rows, counts] = await Promise.all([
    ctx.db
      .select({ e: emailOutbox, team: teams.name })
      .from(emailOutbox)
      .leftJoin(teams, eq(teams.id, emailOutbox.teamId))
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(emailOutbox.createdAt))
      .limit(200),
    ctx.db.select({ status: emailOutbox.status, n: sql<number>`count(*)` }).from(emailOutbox).groupBy(emailOutbox.status),
  ]);
  const count = Object.fromEntries(counts.map((c) => [c.status, c.n]));
  const [sel, sendStatus, payTpl, payStatus] = await Promise.all([selectionContext(ctx), selectionSendStatus(ctx), getTemplate(ctx, "payment"), paymentEmailStatus(ctx)]);
  const sampleTeam = sel.selected[0] ?? null;
  const sample = sampleTeam ? { vars: templateVars(sampleTeam, sel.settings, sel.tpl), members: sampleTeam.members.map((m) => m.fullName), label: `filled in for ${sampleTeam.name}` } : null;
  const paySample = sampleTeam ? { vars: templateVars(sampleTeam, sel.settings, payTpl), members: sampleTeam.members.map((m) => m.fullName), label: `filled in for ${sampleTeam.name}` } : null;
  const provider = ctx.env.EMAIL_PROVIDER;
  const smtpSource = await smtpPasswordSource(ctx);
  const emailOn = await isEmailEnabled(ctx);

  return (
    <>
      <AdminHeader
        title="Email delivery"
        lead={`Provider: ${provider === "smtp" ? `Gmail SMTP via Nodemailer (${ctx.env.SMTP_USER ?? "no user set"})` : provider}${provider === "log" ? " (no provider configured: emails stay queued)" : ""}${provider === "smtp" && !smtpSource ? ". The Gmail App Password is not set (Admin → Settings → Email), so emails are waiting in the queue" : ""}. Queued ${count.QUEUED ?? 0} · sent ${count.SENT ?? 0} · gave up ${count.DEAD ?? 0}. Emails go out automatically every minute; failures retry up to five times.`}
        actions={
          <div className="grid gap-2">
            <ActionForm action={testEmailAction} submitLabel="Send me a test email" submitClass="btn-secondary" />
            <ActionForm action={drainNowAction} submitLabel="Send queued now" submitClass="btn-secondary" />
          </div>
        }
      />
      <Section
        title={emailOn ? "Email sending: ON" : "Email sending: OFF"}
        className={emailOn ? "mb-6 border-success/40" : "mb-6 border-danger/60 bg-danger/5"}
        actions={
          <ActionForm
            action={setEmailEnabledAction}
            submitLabel={emailOn ? "Turn email off" : "Turn email on"}
            submitClass={emailOn ? "btn-danger" : "btn-primary"}
            confirm={
              emailOn
                ? "Turn off all email? Nothing will be sent, and every email still in the queue is cancelled for good."
                : "Turn email back on? New emails will be sent from now on. Emails cancelled while it was off stay cancelled."
            }
          >
            <input type="hidden" name="enabled" value={emailOn ? "0" : "1"} />
          </ActionForm>
        }
      >
        <p className="text-sm text-muted">
          {emailOn
            ? "Emails are sent automatically: registration and payment confirmations, status codes and anything you send from this page. Turning email off stops all of them at once and cancels whatever is waiting."
            : `Nothing is being sent. Any email the site creates is cancelled instead of sent (shown below as “gave up”: ${CANCELLED_NOTE}). Teams cannot get a status code by email; they can still use the personal link from their registration email.`}
        </p>
      </Section>
      <Section title={`Payment confirmation email: send per team (${sel.selected.length} teams)`} className="mb-6 border-success/40">
        <p className="mb-4 text-sm text-muted">
          After you have verified a team&apos;s bKash payment, press <strong>Send payment confirmation</strong> on that team. It emails the payment-confirmed template (edit it below) to every member of that team only, from{" "}
          <strong>{ctx.env.EMAIL_FROM ?? ctx.env.SMTP_USER}</strong>. Nothing is sent until you press a team&apos;s button, and each member gets it once.
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Team</th>
                <th scope="col">Members</th>
                <th scope="col">Payment email</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sel.selected.map((t, i) => {
                const st = payStatus[t.id];
                const done = st && st.sent >= t.members.length;
                return (
                  <tr key={t.id} className={done ? "bg-success/[0.06]" : undefined}>
                    <td className="font-mono text-muted">{i + 1}</td>
                    <td className="min-w-48">
                      <span className="font-semibold">{t.name}</span>
                      <span className="block font-mono text-xs text-muted">{t.registrationId}</span>
                    </td>
                    <td className="min-w-56 text-xs">
                      {t.members.map((m) => (
                        <span key={m.email} className="block">
                          {m.fullName} · <span className="text-muted">{m.email}</span>
                        </span>
                      ))}
                    </td>
                    <td className="whitespace-nowrap text-sm">
                      {!st ? (
                        <span className="text-muted">Not sent</span>
                      ) : (
                        <span className={done ? "text-success" : undefined}>
                          Sent {st.sent}/{t.members.length}
                          {st.queued > 0 && ` · ${st.queued} queued`}
                          {st.failed > 0 && <span className="text-danger"> · {st.failed} failed</span>}
                        </span>
                      )}
                    </td>
                    <td className="min-w-64">
                      <div className="flex flex-wrap items-center gap-2">
                        <ActionForm
                          action={sendPaymentConfirmationAction}
                          submitLabel={done ? "Send again to new members" : "Send payment confirmation"}
                          submitClass={done ? "btn-secondary" : "btn-primary"}
                          inline
                          confirm={`Email the payment confirmation to ${t.name} (${t.members.length} member${t.members.length === 1 ? "" : "s"}) now?`}
                        >
                          <input type="hidden" name="teamId" value={t.id} />
                        </ActionForm>
                        <a className="btn btn-secondary btn-sm" href={`/admin/final-selection/preview/${t.id}?kind=payment`} target="_blank" rel="noreferrer">
                          Preview
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Payment confirmation email template" className="mb-6">
        <SelectionTemplateEditor
          action={savePaymentTemplateAction}
          initial={payTpl}
          defaults={DEFAULT_PAYMENT_TEMPLATE}
          sample={paySample}
          assetBase={sel.assetBase}
          canEdit
          footnote="Saving never sends anything. Each team's email goes out only when you press its Send payment confirmation button above."
        />
      </Section>

      <Section title="Send the selection email to all selected teams" className="mb-6 border-warning/40">
        <p className="mb-3 text-sm text-muted">
          Sends the template below, personalised for each team (team name and members), to <strong>every member</strong> of the{" "}
          <strong>{sendStatus.teams} selected teams</strong> ({sendStatus.participants} people), from <strong>{ctx.env.EMAIL_FROM ?? ctx.env.SMTP_USER}</strong>. Waiting and rejected teams are not emailed. Each person
          gets it once: pressing again only emails members who have not had it yet.
        </p>
        <p className="mb-4 text-sm">
          Status:{" "}
          {sendStatus.total === 0 ? (
            <span className="text-muted">not sent yet.</span>
          ) : (
            <span>
              {sendStatus.byStatus.SENT ?? 0} sent · {sendStatus.byStatus.QUEUED ?? 0} queued · {sendStatus.byStatus.DEAD ?? 0} failed (of {sendStatus.total}). Emails go out about 10 per minute.
            </span>
          )}
        </p>
        {can(admin.role, "emails.broadcast") ? (
          sendStatus.teams > 0 && (
            <ActionForm
              action={sendSelectionEmailsAction}
              submitLabel={`Send to all ${sendStatus.teams} teams (${sendStatus.participants} emails)`}
              submitClass="btn-danger"
              confirm={`Email the selection message to all ${sendStatus.participants} members of the ${sendStatus.teams} selected teams now? Save any template changes first.`}
              confirmPhrase="SEND"
            >
              <input type="hidden" name="confirm" value="SEND" />
            </ActionForm>
          )
        ) : (
          <p className="text-sm text-muted">Only a super admin can send this.</p>
        )}
      </Section>

      <Section title={`Waiting list: select & send the selection email (${sel.waiting.length} teams)`} className="mb-6">
        <p className="mb-4 text-sm text-muted">
          When you pick a waiting team for the final, press <strong>Select &amp; send selection email</strong> on it. It moves the team to the selected list (above the limit if needed, recorded as an override) and emails the selection template below to that team&apos;s members only. Nothing is sent until you press a team&apos;s button. Super admins only.
        </p>
        {sel.waiting.length === 0 ? (
          <p className="text-sm text-muted">No teams on the waiting list.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Queue</th>
                  <th scope="col">Team</th>
                  <th scope="col">Members</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sel.waiting.map((t) => (
                  <tr key={t.id}>
                    <td className="font-mono font-semibold">#{t.waitlist}</td>
                    <td className="min-w-48">
                      <span className="font-semibold">{t.name}</span>
                      <span className="block font-mono text-xs text-muted">
                        {t.registrationId} · score {t.score ?? "—"}
                      </span>
                    </td>
                    <td className="min-w-56 text-xs">
                      {t.members.map((m) => (
                        <span key={m.email} className="block">
                          {m.fullName} · <span className="text-muted">{m.email}</span>
                        </span>
                      ))}
                    </td>
                    <td className="min-w-64">
                      <div className="flex flex-wrap items-center gap-2">
                        {can(admin.role, "emails.broadcast") ? <WaitlistSelectButton teamId={t.id} teamName={t.name} members={t.members.length} /> : <span className="text-xs text-muted">Super admin only</span>}
                        <a className="btn btn-secondary btn-sm" href={`/admin/final-selection/preview/${t.id}`} target="_blank" rel="noreferrer">
                          Preview
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Selection email template" className="mb-6">
        <p className="mb-4 text-sm text-muted">
          Choose the design (TECHNOVA orange or Purple banner) and edit the email for the selected teams. Saving does not send anything. Send it to everyone with the button above, or to one team by hand from Final selection.
        </p>
        <SelectionTemplateEditor action={saveSelectionTemplateAction} initial={sel.tpl} sample={sample} assetBase={sel.assetBase} canEdit />
      </Section>
      <form className="card mb-5 flex flex-wrap gap-3 p-4" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Recipient email" aria-label="Recipient" className="input min-w-56 flex-1" />
        <select name="status" defaultValue={sp.status ?? ""} className="input w-auto" aria-label="Status">
          <option value="">Any status</option>
          {EMAIL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.toLowerCase()}
            </option>
          ))}
        </select>
        <select name="template" defaultValue={sp.template ?? ""} className="input w-auto" aria-label="Type">
          <option value="">Any type</option>
          {Object.entries(TEMPLATE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className="btn btn-primary">Apply</button>
      </form>
      {rows.length === 0 ? (
        <Empty>No emails in this view.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Recipient</th>
                <th scope="col">Status</th>
                <th scope="col">Attempts</th>
                <th scope="col">When</th>
                <th scope="col">
                  <span className="sr-only">Resend</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ e, team }) => (
                <tr key={e.id}>
                  <td>
                    {TEMPLATE_LABELS[e.template as TemplateName] ?? e.template}
                    {e.requestedBy && <span className="block text-xs text-muted">manual</span>}
                  </td>
                  <td>
                    {e.toEmail}
                    {team && <span className="block text-xs text-muted">{team}</span>}
                  </td>
                  <td>
                    <StatusBadge status={e.status} />
                    {e.lastError && e.status !== "SENT" && <span className="mt-1 block max-w-64 truncate text-xs text-danger" title={e.lastError}>{e.lastError}</span>}
                  </td>
                  <td className="font-mono">{e.attempts}</td>
                  <td className="whitespace-nowrap text-muted">{formatDhaka(e.sentAt ?? e.createdAt)}</td>
                  <td>
                    {e.template !== "status_otp" && (
                      <ActionForm action={resendEmailAction} submitLabel="Resend" submitClass="btn-ghost" inline confirm={`Send this email to ${e.toEmail} again?`}>
                        <input type="hidden" name="id" value={e.id} />
                      </ActionForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
