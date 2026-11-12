import { and, desc, eq, like, or, type SQL } from "drizzle-orm";
import Link from "next/link";
import { rejectPaymentAction, verifyPaymentAction } from "@/app/admin/actions/payments";
import { ActionForm } from "@/components/admin/action-form";
import { AdminHeader, Empty, StatusBadge } from "@/components/admin/ui";
import { admins, participants, payments, teams } from "@/lib/db/schema";
import { requireAdminPage } from "@/lib/server";
import { getSettings } from "@/lib/settings";
import { formatDhaka } from "@/lib/time";

export const metadata = { title: "Payments" };

export default async function Payments({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx } = await requireAdminPage("payments.verify");
  const sp = await searchParams;
  const status = sp.status ?? "PENDING_VERIFICATION";
  const where: (SQL | undefined)[] = [];
  if (status !== "ALL") where.push(eq(payments.status, status as never));
  if (sp.provider) where.push(eq(payments.provider, sp.provider as never));
  if (sp.q?.trim()) {
    const p = `%${sp.q.trim().replace(/[%_]/g, "")}%`;
    where.push(or(like(payments.transactionId, p.toUpperCase()), like(payments.senderPhone, p), like(teams.name, p), like(teams.registrationId, p.toUpperCase())));
  }
  const [rows, settings, leaders] = await Promise.all([
    ctx.db
      .select({ p: payments, teamName: teams.name, registrationId: teams.registrationId, teamId: teams.id, decidedBy: admins.name })
      .from(payments)
      .innerJoin(teams, eq(teams.id, payments.teamId))
      .leftJoin(admins, eq(admins.id, payments.decidedBy))
      .where(and(...where))
      .orderBy(desc(payments.createdAt))
      .limit(200),
    getSettings(ctx),
    ctx.db.select({ teamId: participants.teamId, name: participants.fullName, phone: participants.phone }).from(participants).where(eq(participants.position, 1)),
  ]);
  const leaderOf = new Map(leaders.map((l) => [l.teamId, l]));

  return (
    <>
      <AdminHeader title="Payment verification" lead={`Check each transaction against the bKash or Nagad statement before verifying. Expected amount: BDT ${settings.feeBdt}. Receiving numbers: bKash ${settings.bkashNumber || "not set"}, Nagad ${settings.nagadNumber || "not set"}.`} />
      <form className="card mb-5 flex flex-wrap gap-3 p-4" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Transaction ID, sender, team…" aria-label="Search" className="input min-w-56 flex-1" />
        <select name="status" defaultValue={status} className="input w-auto" aria-label="Status">
          <option value="PENDING_VERIFICATION">Pending</option>
          <option value="VERIFIED">Verified</option>
          <option value="REJECTED">Rejected</option>
          <option value="ALL">All</option>
        </select>
        <select name="provider" defaultValue={sp.provider ?? ""} className="input w-auto" aria-label="Provider">
          <option value="">bKash and Nagad</option>
          <option value="BKASH">bKash</option>
          <option value="NAGAD">Nagad</option>
        </select>
        <button className="btn btn-primary">Apply</button>
      </form>
      {rows.length === 0 ? (
        <Empty>No payments in this view.</Empty>
      ) : (
        <ul className="grid gap-4">
          {rows.map(({ p, teamName, registrationId, teamId, decidedBy }) => {
            const leader = leaderOf.get(teamId);
            const amountWrong = p.amountBdt !== settings.feeBdt;
            return (
              <li key={p.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="text-sm">
                    <p className="text-base font-semibold">
                      <Link href={`/admin/registrations/${teamId}`} className="hover:text-primary-soft">
                        {teamName}
                      </Link>{" "}
                      <span className="font-mono text-xs text-muted">{registrationId}</span>
                    </p>
                    <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                      <div>
                        <dt className="text-xs text-muted">Method</dt>
                        <dd className="font-medium">{p.provider === "BKASH" ? "bKash" : "Nagad"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Transaction ID</dt>
                        <dd className="font-mono font-semibold">{p.transactionId}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Sender</dt>
                        <dd className="font-mono">{p.senderPhone}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Amount</dt>
                        <dd className={`font-mono ${amountWrong ? "text-danger" : ""}`}>BDT {p.amountBdt}</dd>
                      </div>
                    </dl>
                    <p className="mt-2 text-xs text-muted">
                      Submitted {formatDhaka(p.createdAt)}
                      {leader && ` · leader ${leader.name}, ${leader.phone}`}
                      {decidedBy && ` · decided by ${decidedBy} ${formatDhaka(p.decidedAt)}`}
                    </p>
                    {p.rejectionReason && <p className="mt-1 text-sm text-danger">Rejected: {p.rejectionReason}</p>}
                    {p.internalNote && <p className="mt-1 text-sm text-muted">Note: {p.internalNote}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    {p.screenshotFileId && (
                      <a href={`/api/v1/admin/files/${p.screenshotFileId}`} target="_blank" rel="noopener">
                        {/* eslint-disable-next-line @next/next/no-img-element -- authorised private file */}
                        <img src={`/api/v1/admin/files/${p.screenshotFileId}`} alt="Payment screenshot" className="h-20 w-20 rounded-lg border border-line object-cover" loading="lazy" />
                      </a>
                    )}
                    <StatusBadge status={p.status} />
                  </div>
                </div>
                {p.status === "PENDING_VERIFICATION" && (
                  <div className="mt-4 grid gap-4 border-t border-line pt-4 md:grid-cols-2">
                    <ActionForm action={verifyPaymentAction} submitLabel="Verify payment" confirm={`Verify ${p.transactionId} for ${teamName}? The team will be confirmed and emailed.`}>
                      <input type="hidden" name="paymentId" value={p.id} />
                      <input name="note" placeholder="Internal note (optional)" className="input" maxLength={500} />
                    </ActionForm>
                    <ActionForm action={rejectPaymentAction} submitLabel="Reject" submitClass="btn-danger">
                      <input type="hidden" name="paymentId" value={p.id} />
                      <input name="reason" required minLength={5} placeholder="Reason shown to the team" className="input" maxLength={300} />
                      <input name="note" placeholder="Internal note (optional)" className="input" maxLength={500} />
                    </ActionForm>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
