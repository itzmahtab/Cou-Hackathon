import { and, desc, eq, like, sql, type SQL } from "drizzle-orm";
import { drainNowAction, resendEmailAction, testEmailAction } from "@/app/admin/actions/results";
import { ActionForm } from "@/components/admin/action-form";
import { AdminHeader, Empty, StatusBadge } from "@/components/admin/ui";
import { smtpPasswordSource } from "@/features/email/config";
import { TEMPLATE_LABELS, type TemplateName } from "@/features/email/templates";
import { EMAIL_STATUSES } from "@/lib/constants";
import { emailOutbox, teams } from "@/lib/db/schema";
import { requireAdminPage } from "@/lib/server";
import { formatDhaka } from "@/lib/time";

export const metadata = { title: "Emails" };

export default async function Emails({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx } = await requireAdminPage("emails.manage");
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
  const provider = ctx.env.EMAIL_PROVIDER;
  const smtpSource = await smtpPasswordSource(ctx);

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
