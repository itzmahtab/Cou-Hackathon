import Link from "next/link";
import { AdminHeader, Empty } from "@/components/admin/ui";
import { ideaForReview } from "@/features/reviews/queries";
import { requireAdminPage } from "@/lib/server";

export const metadata = { title: "Compare ideas" };

export default async function Compare({ searchParams }: { searchParams: Promise<{ ids?: string | string[] }> }) {
  const { ctx } = await requireAdminPage("reviews.read");
  const raw = (await searchParams).ids;
  const ids = (Array.isArray(raw) ? raw : raw ? [raw] : []).slice(0, 3);
  const ideas = (await Promise.all(ids.map((id) => ideaForReview(ctx, id)))).filter((x): x is NonNullable<typeof x> => !!x);
  return (
    <>
      <p className="mb-3 text-sm">
        <Link href="/admin/reviews" className="text-muted hover:text-fg">
          ← All ideas
        </Link>
      </p>
      <AdminHeader title="Compare ideas" lead="Up to three ideas side by side." />
      {ideas.length < 2 ? (
        <Empty>Tick two or three ideas on the review list, then choose Compare selected.</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {ideas.map((d) => (
            <article key={d.team.id} className="card p-5 text-sm">
              <h2 className="text-base font-semibold">
                <Link href={`/admin/reviews/${d.team.id}`} className="hover:text-primary-soft">
                  {d.idea.title}
                </Link>
              </h2>
              <p className="mt-1 text-muted">
                {d.team.name} · average <span className="font-mono">{d.team.reviewScoreAvg ?? "—"}</span>
              </p>
              {(
                [
                  ["Problem", d.idea.problemStatement],
                  ["Solution", d.idea.proposedSolution],
                  ["AI", d.idea.aiComponent],
                  ["Impact", d.idea.expectedImpact],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="mt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{k}</h3>
                  <p className="mt-1 whitespace-pre-line leading-relaxed">{v}</p>
                </div>
              ))}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
