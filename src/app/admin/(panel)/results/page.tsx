import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { autoRankAction, publishResultsAction, saveResultAction, unpublishResultsAction } from "@/app/admin/actions/results";
import { ActionForm } from "@/components/admin/action-form";
import { AdminHeader, Empty, Section } from "@/components/admin/ui";
import { buildPublicRows, getPublicLeaderboard } from "@/features/results/service";
import { can } from "@/lib/auth/permissions";
import { POSITIONS } from "@/lib/constants";
import { finalResults, ideaSubmissions, teams } from "@/lib/db/schema";
import { requireAdminPage } from "@/lib/server";
import { PRIZES } from "@/lib/settings";
import { formatDhaka } from "@/lib/time";

export const metadata = { title: "Results" };

export default async function Results() {
  const { ctx, admin } = await requireAdminPage("results.manage");
  const [rows, preview, live] = await Promise.all([
    ctx.db
      .select({ id: teams.id, name: teams.name, registrationId: teams.registrationId, title: ideaSubmissions.title, r: finalResults })
      .from(teams)
      .innerJoin(ideaSubmissions, eq(ideaSubmissions.teamId, teams.id))
      .leftJoin(finalResults, eq(finalResults.teamId, teams.id))
      .where(eq(teams.status, "CONFIRMED"))
      .orderBy(desc(finalResults.totalScore), asc(teams.nameNorm)),
    buildPublicRows(ctx),
    getPublicLeaderboard(ctx),
  ]);
  const publish = can(admin.role, "results.publish");
  const label = (p: string | null) => PRIZES.find((x) => x.position === p)?.label ?? "";

  return (
    <>
      <AdminHeader
        title="Final results"
        lead={live.published ? `The leaderboard is public (published ${formatDhaka(live.publishedAt)}). Changes below stay private until you publish again.` : "The leaderboard is not public yet. Enter scores, check the preview, then publish."}
        actions={
          <Link href="/leaderboard" target="_blank" className="btn btn-secondary btn-sm">
            Open public page
          </Link>
        }
      />
      {rows.length === 0 ? (
        <Empty>Only confirmed teams can receive results. None yet.</Empty>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Team</th>
                  <th scope="col">Score, rank, position and private feedback</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td className="w-64">
                      <p className="font-semibold">{t.name}</p>
                      <p className="text-xs text-muted">{t.title}</p>
                      {t.r?.position && <span className="badge badge-warning mt-1">{label(t.r.position)}</span>}
                    </td>
                    <td>
                      <ActionForm action={saveResultAction} submitLabel="Save" submitClass="btn-secondary">
                        <input type="hidden" name="teamId" value={t.id} />
                        <div className="grid grid-cols-3 gap-2">
                          <input name="totalScore" type="number" step="0.01" min={0} defaultValue={t.r?.totalScore} placeholder="Score" aria-label={`Score for ${t.name}`} className="input font-mono" required />
                          <input name="rank" type="number" min={1} defaultValue={t.r?.rank ?? ""} placeholder="Rank" aria-label={`Rank for ${t.name}`} className="input font-mono" />
                          <select name="position" defaultValue={t.r?.position ?? ""} aria-label={`Prize for ${t.name}`} className="input">
                            <option value="">No prize</option>
                            {POSITIONS.map((p) => (
                              <option key={p} value={p}>
                                {label(p)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <textarea name="judgeFeedback" defaultValue={t.r?.judgeFeedback ?? ""} rows={2} placeholder="Judge feedback (private)" aria-label={`Feedback for ${t.name}`} className="input min-h-14" />
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <ActionForm action={autoRankAction} submitLabel="Rank automatically by score" submitClass="btn-secondary" confirm="Overwrite every rank and prize position using the scores?" />
          </div>
        </>
      )}

      <Section title="Preview (only admins see this)" className="mt-8">
        {preview.length === 0 ? (
          <p className="text-sm text-muted">Nothing to preview yet.</p>
        ) : (
          <ol className="grid gap-1.5 text-sm">
            {preview.map((r) => (
              <li key={`${r.rank}-${r.teamName}`} className="grid grid-cols-[3rem_1fr_6rem_8rem] gap-3">
                <span className="font-mono">{r.rank ?? "—"}</span>
                <span>
                  {r.teamName} <span className="text-muted">· {r.projectTitle}</span>
                </span>
                <span className="font-mono">{r.totalScore}</span>
                <span className="text-warning">{r.prizeBdt ? `BDT ${r.prizeBdt.toLocaleString("en-US")}` : ""}</span>
              </li>
            ))}
          </ol>
        )}
        {publish && (
          <div className="mt-6 flex flex-wrap gap-4 border-t border-line pt-5">
            <ActionForm action={publishResultsAction} submitLabel={live.published ? "Publish again" : "Publish results"} confirm="Make these results public on the leaderboard?">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="notify" value="1" className="h-4 w-4 accent-[#8b5cf6]" /> Also email every confirmed participant
              </label>
            </ActionForm>
            {live.published && <ActionForm action={unpublishResultsAction} submitLabel="Unpublish" submitClass="btn-danger" confirm="Hide the public leaderboard?" />}
          </div>
        )}
      </Section>
    </>
  );
}
