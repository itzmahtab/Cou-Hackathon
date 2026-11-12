import { FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { saveReviewAction } from "@/app/admin/actions/review";
import { ActionForm } from "@/components/admin/action-form";
import { AdminHeader, Section, StatusBadge } from "@/components/admin/ui";
import { ideaForReview } from "@/features/reviews/queries";
import { CRITERIA } from "@/features/reviews/service";
import { can } from "@/lib/auth/permissions";
import { requireAdminPage } from "@/lib/server";
import { formatDhaka } from "@/lib/time";

export const metadata = { title: "Review idea" };

export default async function ReviewIdea({ params }: { params: Promise<{ teamId: string }> }) {
  const { ctx, admin } = await requireAdminPage("reviews.read");
  const { teamId } = await params;
  const d = await ideaForReview(ctx, teamId);
  if (!d) notFound();
  const mine = d.reviews.find((r) => r.review.reviewerId === admin.id)?.review;
  const locked = !["SUBMITTED", "UNDER_REVIEW"].includes(d.team.status);
  // Reviewers score independently; only a super admin sees the other reviewers' scores and notes.
  const others = admin.role === "SUPER_ADMIN" ? d.reviews.filter((r) => r.review.reviewerId !== admin.id) : [];

  return (
    <>
      <p className="mb-3 text-sm">
        <Link href="/admin/reviews" className="text-muted hover:text-fg">
          ← All ideas
        </Link>
      </p>
      <AdminHeader title={d.idea.title} lead={`${d.team.name} · ${d.team.registrationId} · submitted ${formatDhaka(d.idea.createdAt)} · average ${d.team.reviewScoreAvg ?? "—"} from ${d.team.reviewCount} review(s)`} actions={<StatusBadge status={d.team.status} />} />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Section
          title="Submission"
          actions={
            d.idea.documentFileId && (
              <a className="btn btn-secondary btn-sm" href={`/api/v1/admin/files/${d.idea.documentFileId}`}>
                <FileText size={15} aria-hidden /> Download document
              </a>
            )
          }
        >
          <dl className="grid gap-5 text-sm">
            {(
              [
                ["Problem statement", d.idea.problemStatement],
                ["Proposed solution", d.idea.proposedSolution],
                ["AI component", d.idea.aiComponent],
                ["Expected impact", d.idea.expectedImpact],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="font-medium">{k}</dt>
                <dd className="mt-1 whitespace-pre-line leading-relaxed text-muted">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-xs text-muted">Documents come from participants. Open them in your browser&apos;s viewer rather than enabling macros or editing.</p>
        </Section>
        <div className="grid h-fit gap-6">
          <Section title={mine ? "Your review" : "Score this idea"}>
            {locked ? (
              <p className="text-sm text-muted">Reviews are locked because the shortlist has been finalised.{mine ? ` Your score: ${mine.total} / 100.` : ""}</p>
            ) : !can(admin.role, "reviews.write") ? (
              <p className="text-sm text-muted">Your role can read reviews but not score.</p>
            ) : (
              <ActionForm action={saveReviewAction} submitLabel={mine ? "Update review" : "Save review"}>
                <input type="hidden" name="teamId" value={d.team.id} />
                {CRITERIA.map((c) => (
                  <label key={c.key} className="grid grid-cols-[1fr_5.5rem] items-center gap-3 text-sm">
                    <span>
                      {c.label} <span className="text-muted">/ {c.max}</span>
                    </span>
                    <input name={c.key} type="number" inputMode="numeric" min={0} max={c.max} step={1} required defaultValue={mine?.[c.key]} className="input text-right font-mono" />
                  </label>
                ))}
                <label className="text-sm">
                  <span className="field-label">Private notes (never shown to participants)</span>
                  <textarea name="notes" defaultValue={mine?.notes ?? ""} rows={4} maxLength={4000} className="input min-h-24" />
                </label>
              </ActionForm>
            )}
          </Section>
          {others.length > 0 && (
            <Section title="Other reviewers">
              <ul className="grid gap-3 text-sm">
                {others.map(({ review, reviewer }) => (
                  <li key={review.id} className="rounded-xl border border-line p-3">
                    <p className="font-medium">
                      {reviewer} · <span className="font-mono">{review.total}</span>
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted">
                      {review.scoreRelevance} / {review.scoreInnovation} / {review.scoreAi} / {review.scoreFeasibility} / {review.scoreImpact}
                    </p>
                    {review.notes && <p className="mt-2 whitespace-pre-line text-muted">{review.notes}</p>}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
