import { Download } from "lucide-react";
import { deleteShowcaseAction, rejectShowcaseAction, verifyShowcaseAction } from "@/app/admin/actions/showcase";
import { ActionForm } from "@/components/admin/action-form";
import { AdminHeader, Empty, Stat, StatusBadge } from "@/components/admin/ui";
import { formatPhone } from "@/config/content";
import { SHOWCASE } from "@/config/showcase";
import { listShowcase, showcaseStats, showcaseWindow } from "@/features/showcase/service";
import { can } from "@/lib/auth/permissions";
import { SHOWCASE_CATEGORIES } from "@/lib/constants";
import { requireAdminPage } from "@/lib/server";
import { formatDhaka } from "@/lib/time";

export const metadata = { title: "Project Showcase" };

const STATUS_LABEL: Record<string, string> = { PENDING_VERIFICATION: "PENDING_VERIFICATION", CONFIRMED: "VERIFIED", REJECTED: "REJECTED" };

export default async function ShowcaseAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, admin } = await requireAdminPage("registrations.read");
  const sp = await searchParams;
  const [rows, stats] = await Promise.all([listShowcase(ctx, { q: sp.q, status: sp.status, category: sp.category }), showcaseStats(ctx)]);
  const verify = can(admin.role, "payments.verify");
  const contact = can(admin.role, "registrations.contact");
  const regWindow = showcaseWindow(ctx.now());

  return (
    <>
      <AdminHeader
        title="Project Showcase"
        lead={`Comilla University students only · ${SHOWCASE.eventDate} · registration ${regWindow}. Fees go to bKash ${formatPhone(SHOWCASE.bkash)}; check each transaction ID against the bKash statement before verifying.`}
        actions={
          can(admin.role, "registrations.export") && (
            <>
              <a className="btn btn-secondary btn-sm" href="/api/v1/admin/export/showcase">
                <Download size={15} aria-hidden /> Export all
              </a>
              <a className="btn btn-secondary btn-sm" href="/api/v1/admin/export/showcase?status=CONFIRMED">
                <Download size={15} aria-hidden /> Export confirmed
              </a>
            </>
          )
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Teams" value={stats.teams} hint={`${stats.participants} participants`} />
        <Stat label="To verify" value={stats.pending} />
        <Stat label="Confirmed" value={stats.confirmed} hint={`${stats.confirmedParticipants} participants`} />
        <Stat label="Fees verified" value={`৳${stats.feesConfirmed}`} hint={stats.rejected ? `${stats.rejected} rejected` : undefined} />
      </div>

      <form className="card mb-5 flex flex-wrap gap-3 p-4" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Name, student ID, email, project, TrxID or SHOW26-…" aria-label="Search" className="input min-w-64 flex-1" />
        <select name="status" defaultValue={sp.status ?? ""} className="input w-auto" aria-label="Status">
          <option value="">Any status</option>
          <option value="PENDING_VERIFICATION">To verify</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select name="category" defaultValue={sp.category ?? ""} className="input w-auto" aria-label="Category">
          <option value="">Any category</option>
          {SHOWCASE_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button className="btn btn-primary">Apply</button>
      </form>

      {rows.length === 0 ? (
        <Empty>No showcase registrations in this view yet.</Empty>
      ) : (
        <ul className="grid gap-4">
          {rows.map((r) => (
            <li key={r.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold">{r.projectTitle}</p>
                  <p className="text-sm text-muted">
                    <span className="font-mono">{r.registrationId}</span> · {r.category} · {r.teamSize} member{r.teamSize > 1 ? "s" : ""} · registered {formatDhaka(r.createdAt)}
                  </p>
                </div>
                <StatusBadge status={STATUS_LABEL[r.status]} />
              </div>
              <p className="mt-3 whitespace-pre-line text-sm text-muted">{r.description}</p>

              <div className="table-wrap mt-4">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Name</th>
                      <th scope="col">Student ID</th>
                      <th scope="col">Dept · Session</th>
                      {contact && <th scope="col">Contact</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {r.members.map((m) => (
                      <tr key={m.id}>
                        <td className="font-mono">{m.position}</td>
                        <td className="font-medium">{m.fullName}</td>
                        <td className="font-mono">{m.studentId}</td>
                        <td className="text-muted">
                          {m.department} · {m.session}
                        </td>
                        {contact && (
                          <td className="text-muted">
                            {m.phone}
                            <span className="block text-xs">{m.email}</span>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted">Fee</dt>
                  <dd className="font-mono">BDT {r.feeBdt}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">bKash sender</dt>
                  <dd className="font-mono">{r.senderPhone}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted">Transaction ID</dt>
                  <dd className="font-mono font-semibold">{r.transactionId}</dd>
                </div>
              </dl>
              {r.rejectionReason && <p className="mt-2 text-sm text-danger">Rejected: {r.rejectionReason}</p>}
              {r.internalNote && <p className="mt-1 text-sm text-muted">Note: {r.internalNote}</p>}
              {r.decidedAt && <p className="mt-1 text-xs text-muted">Decided {formatDhaka(r.decidedAt)}</p>}

              {verify && r.status === "PENDING_VERIFICATION" && (
                <div className="mt-4 grid gap-4 border-t border-line pt-4 md:grid-cols-2">
                  <ActionForm action={verifyShowcaseAction} submitLabel="Verify payment" confirm={`Verify ${r.transactionId} (BDT ${r.feeBdt}) for "${r.projectTitle}"? The team will be emailed.`}>
                    <input type="hidden" name="id" value={r.id} />
                    <input name="note" placeholder="Internal note (optional)" className="input" maxLength={500} />
                  </ActionForm>
                  <ActionForm action={rejectShowcaseAction} submitLabel="Reject" submitClass="btn-danger">
                    <input type="hidden" name="id" value={r.id} />
                    <input name="reason" required minLength={5} placeholder="Reason shown to the team" className="input" maxLength={300} />
                  </ActionForm>
                </div>
              )}
              {can(admin.role, "registrations.write") && r.status === "REJECTED" && (
                <div className="mt-4 border-t border-line pt-4">
                  <ActionForm action={deleteShowcaseAction} submitLabel="Delete so they can register again" submitClass="btn-ghost" confirm="Delete this rejected registration? The students can then register again.">
                    <input type="hidden" name="id" value={r.id} />
                  </ActionForm>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
