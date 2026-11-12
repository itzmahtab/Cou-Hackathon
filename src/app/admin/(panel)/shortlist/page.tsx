import { Download } from "lucide-react";
import Link from "next/link";
import { finaliseShortlistAction, setCandidateAction } from "@/app/admin/actions/review";
import { ActionForm } from "@/components/admin/action-form";
import { AdminHeader, Empty, Section, StatusBadge } from "@/components/admin/ui";
import { shortlistBoard } from "@/features/reviews/queries";
import { finalisedAt } from "@/features/shortlist/service";
import { can } from "@/lib/auth/permissions";
import { getSettings } from "@/lib/settings";
import { requireAdminPage } from "@/lib/server";
import { formatDhaka } from "@/lib/time";

export const metadata = { title: "Shortlist" };

export default async function Shortlist() {
  const { ctx, admin } = await requireAdminPage("shortlist.read");
  const [{ rows, history }, settings, finalised] = await Promise.all([shortlistBoard(ctx), getSettings(ctx), finalisedAt(ctx)]);
  const count = rows.filter((r) => r.isCandidate).length;
  const cap = settings.shortlistCapacity;
  const manage = can(admin.role, "shortlist.manage") && !finalised;
  const override = can(admin.role, "shortlist.override");
  const unreviewed = rows.filter((r) => r.count === 0 && !["NOT_SELECTED"].includes(r.status)).length;

  return (
    <>
      <AdminHeader
        title="Top teams selection"
        lead={finalised ? `Finalised ${formatDhaka(finalised)}. Selection emails have been queued.` : `Ranked by average review score. Select up to ${cap} teams, then a super admin finalises the shortlist.`}
        actions={
          can(admin.role, "registrations.export") && (
            <a className="btn btn-secondary btn-sm" href="/api/v1/admin/export/registrations?status=SHORTLISTED,CONFIRMED">
              <Download size={15} aria-hidden /> Export shortlisted
            </a>
          )
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className={`card p-5 ${count > cap ? "border-danger/50" : ""}`}>
          <p className="text-xs uppercase tracking-wider text-muted">Selected</p>
          <p className="mt-2 font-mono text-3xl font-semibold">
            {count} <span className="text-lg text-muted">/ {cap}</span>
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wider text-muted">Ideas without a review</p>
          <p className="mt-2 font-mono text-3xl font-semibold">{unreviewed}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wider text-muted">Teams in contention</p>
          <p className="mt-2 font-mono text-3xl font-semibold">{rows.length}</p>
        </div>
      </div>

      {!finalised && can(admin.role, "shortlist.finalise") && (
        <Section title="Finalise shortlist" className="mb-6 border-warning/40">
          <p className="mb-4 text-sm text-muted">
            This marks the {count} selected team(s) as shortlisted and every other team as not selected, and emails every participant. It cannot be undone. {unreviewed > 0 && <strong className="text-warning">{unreviewed} idea(s) have no review yet.</strong>}
          </p>
          <ActionForm action={finaliseShortlistAction} submitLabel={`Finalise ${count} teams and send emails`} submitClass="btn-danger" confirm={`Finalise the shortlist with ${count} teams and email all participants?`} confirmPhrase="FINALISE">
            <input type="hidden" name="confirm" value="FINALISE" />
          </ActionForm>
        </Section>
      )}

      {rows.length === 0 ? (
        <Empty>No ideas yet.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Idea and team</th>
                <th scope="col">Average</th>
                <th scope="col">Reviews</th>
                <th scope="col">Status</th>
                <th scope="col">Selection</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={r.isCandidate ? "bg-primary/[0.06]" : undefined}>
                  <td className="font-mono text-muted">{i + 1}</td>
                  <td>
                    <Link href={`/admin/reviews/${r.id}`} className="font-semibold hover:text-primary-soft">
                      {r.title}
                    </Link>
                    <span className="block text-xs text-muted">
                      {r.name} · {r.registrationId} · {r.size} member(s)
                    </span>
                  </td>
                  <td className="font-mono">{r.score ?? "—"}</td>
                  <td className="font-mono">{r.count}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="min-w-48">
                    {manage ? (
                      r.isCandidate ? (
                        <ActionForm action={setCandidateAction} submitLabel="Remove" submitClass="btn-secondary" inline>
                          <input type="hidden" name="teamId" value={r.id} />
                          <input type="hidden" name="selected" value="0" />
                        </ActionForm>
                      ) : count < cap ? (
                        <ActionForm action={setCandidateAction} submitLabel="Select" inline>
                          <input type="hidden" name="teamId" value={r.id} />
                          <input type="hidden" name="selected" value="1" />
                        </ActionForm>
                      ) : override ? (
                        <details>
                          <summary className="cursor-pointer text-xs text-warning">Shortlist full · override</summary>
                          <ActionForm action={setCandidateAction} submitLabel="Add anyway" submitClass="btn-danger" className="mt-2">
                            <input type="hidden" name="teamId" value={r.id} />
                            <input type="hidden" name="selected" value="1" />
                            <textarea name="justification" required minLength={20} rows={2} placeholder="Why this team should exceed the limit (min 20 characters)" className="input min-h-16 text-xs" />
                          </ActionForm>
                        </details>
                      ) : (
                        <span className="text-xs text-muted">Shortlist full</span>
                      )
                    ) : r.isCandidate ? (
                      <span className="badge badge-primary">Selected</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Section title="Selection history" className="mt-6">
        {history.length === 0 ? (
          <p className="text-sm text-muted">No changes yet.</p>
        ) : (
          <ul className="grid gap-1.5 text-sm">
            {history.map(({ s, admin: who, team }) => (
              <li key={s.id} className="flex flex-wrap gap-x-3">
                <span className="font-mono text-muted">{formatDhaka(s.createdAt)}</span>
                <span className={s.action === "OVERRIDE_ADD" ? "text-warning" : s.action === "FINALISE" ? "text-success" : ""}>{s.action.replace("_", " ").toLowerCase()}</span>
                <span>{team ?? "all teams"}</span>
                <span className="text-muted">by {who}</span>
                {s.justification && <span className="text-muted">— “{s.justification}”</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
