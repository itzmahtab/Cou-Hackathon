import { FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateParticipantAction, disqualifyTeamAction } from "@/app/admin/actions/registrations";
import { ActionForm } from "@/components/admin/action-form";
import { AdminHeader, Section, StatusBadge } from "@/components/admin/ui";
import { teamDetail } from "@/features/admin/queries";
import { TEMPLATE_LABELS, type TemplateName } from "@/features/email/templates";
import { can } from "@/lib/auth/permissions";
import { TSHIRT_SIZES } from "@/lib/constants";
import { requireAdminPage } from "@/lib/server";
import { formatDhaka } from "@/lib/time";

export const metadata = { title: "Team" };

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { ctx, admin } = await requireAdminPage("registrations.read");
  const { id } = await params;
  const d = await teamDetail(ctx, id);
  if (!d) notFound();
  const contact = can(admin.role, "registrations.contact");
  const editable = can(admin.role, "registrations.write");
  const seeIdea = contact || can(admin.role, "reviews.read");

  return (
    <>
      <p className="mb-3 text-sm">
        <Link href="/admin/registrations" className="text-muted hover:text-fg">
          ← Registrations
        </Link>
      </p>
      <AdminHeader
        title={d.team.name}
        lead={
          <>
            <span className="font-mono">{d.team.registrationId}</span> · registered {formatDhaka(d.team.createdAt)} · {d.team.size} member(s) · review score {d.team.reviewScoreAvg ?? "—"} ({d.team.reviewCount} review
            {d.team.reviewCount === 1 ? "" : "s"})
          </>
        }
        actions={<StatusBadge status={d.team.status} />}
      />

      <div className="grid gap-6">
        <Section title="Participants">
          <div className="grid gap-5">
            {d.members.map((p) => (
              <div key={p.id} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="text-sm">
                    <p className="text-base font-semibold">
                      {p.fullName} {p.position === 1 && <span className="badge badge-primary ml-1">Leader</span>}{" "}
                      {d.attendance.some((a) => a.participantId === p.id) && <span className="badge badge-success ml-1">Checked in</span>}
                    </p>
                    <p className="mt-1 text-muted">
                      {p.university} · ID {p.studentId} · T-shirt {p.tshirtSize}
                    </p>
                    {contact ? (
                      <p className="mt-1 text-muted">
                        {p.email} · {p.phone} · WhatsApp {p.whatsapp}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-muted">Contact details hidden for your role.</p>
                    )}
                  </div>
                  {contact && p.idCardFileId && (
                    <a href={`/api/v1/admin/files/${p.idCardFileId}`} target="_blank" rel="noopener" className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element -- authorised private file */}
                      <img src={`/api/v1/admin/files/${p.idCardFileId}`} alt={`Student ID card of ${p.fullName}`} className="h-24 w-36 rounded-lg border border-line object-cover" loading="lazy" />
                    </a>
                  )}
                </div>
                {editable && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-primary-soft">Correct details</summary>
                    <ActionForm action={updateParticipantAction} submitLabel="Save changes" className="mt-4">
                      <input type="hidden" name="participantId" value={p.id} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(
                          [
                            ["fullName", "Full name", p.fullName],
                            ["email", "Email", p.email],
                            ["phone", "Phone", p.phone],
                            ["whatsapp", "WhatsApp", p.whatsapp],
                            ["university", "University", p.university],
                            ["studentId", "Student ID", p.studentId],
                          ] as const
                        ).map(([name, label, value]) => (
                          <label key={name} className="text-sm">
                            <span className="field-label">{label}</span>
                            <input name={name} defaultValue={value} className="input" required />
                          </label>
                        ))}
                        <label className="text-sm">
                          <span className="field-label">T-shirt</span>
                          <select name="tshirtSize" defaultValue={p.tshirtSize} className="input">
                            {TSHIRT_SIZES.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </ActionForm>
                  </details>
                )}
              </div>
            ))}
          </div>
        </Section>

        {seeIdea && d.idea && (
          <Section
            title={`Idea: ${d.idea.title}`}
            actions={
              d.idea.documentFileId && (
                <a className="btn btn-secondary btn-sm" href={`/api/v1/admin/files/${d.idea.documentFileId}`}>
                  <FileText size={15} aria-hidden /> Download document
                </a>
              )
            }
          >
            <dl className="grid gap-4 text-sm md:grid-cols-2">
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
                  <dd className="mt-1 whitespace-pre-line text-muted">{v}</dd>
                </div>
              ))}
            </dl>
            {can(admin.role, "reviews.write") && (
              <Link href={`/admin/reviews/${d.team.id}`} className="btn btn-primary btn-sm mt-5">
                Review this idea
              </Link>
            )}
          </Section>
        )}

        {d.payments.length > 0 && (can(admin.role, "payments.verify") || contact) && (
          <Section title="Payments">
            <ul className="grid gap-2 text-sm">
              {d.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={p.status} />
                  <span className="font-mono">
                    {p.provider} · {p.transactionId} · BDT {p.amountBdt}
                  </span>
                  <span className="text-muted">{formatDhaka(p.createdAt)}</span>
                  {p.rejectionReason && <span className="text-danger">Reason: {p.rejectionReason}</span>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {contact && (
          <Section title="Emails sent to this team">
            {d.emails.length === 0 ? (
              <p className="text-sm text-muted">None yet.</p>
            ) : (
              <ul className="grid gap-1.5 text-sm">
                {d.emails.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-3">
                    <StatusBadge status={e.status} />
                    <span>{TEMPLATE_LABELS[e.template as TemplateName] ?? e.template}</span>
                    <span className="text-muted">{e.toEmail}</span>
                    <span className="text-muted">{formatDhaka(e.sentAt ?? e.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {can(admin.role, "admins.manage") && d.team.status !== "DISQUALIFIED" && (
          <Section title="Disqualify team">
            <ActionForm action={disqualifyTeamAction} submitLabel="Disqualify" submitClass="btn-danger" confirm={`Disqualify ${d.team.name}? This removes them from the competition.`}>
              <input type="hidden" name="teamId" value={d.team.id} />
              <label className="text-sm">
                <span className="field-label">Reason (recorded in the activity log)</span>
                <input name="reason" className="input" minLength={10} required />
              </label>
            </ActionForm>
          </Section>
        )}
      </div>
    </>
  );
}
