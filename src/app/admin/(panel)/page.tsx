import Link from "next/link";
import { AdminHeader, Section, Stat } from "@/components/admin/ui";
import { dashboardStats } from "@/features/admin/queries";
import { getPhases } from "@/features/event/queries";
import { finalisedAt } from "@/features/shortlist/service";
import { showcaseStats } from "@/features/showcase/service";
import { getSettings } from "@/lib/settings";
import { requireAdminPage } from "@/lib/server";
import { formatDhaka } from "@/lib/time";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const { ctx, admin } = await requireAdminPage();
  const [s, settings, finalised, sc] = await Promise.all([dashboardStats(ctx), getSettings(ctx), finalisedAt(ctx), showcaseStats(ctx)]);
  const phases = getPhases(settings, ctx.now());
  const maxTrend = Math.max(1, ...s.trend.map((t) => t.n));
  const maxUni = Math.max(1, ...s.universities.map((u) => u.n));
  const phaseLabel = ["Phase 1 registration", "Idea review", "Phase 2 payment", "Hackathon day", "After the event"][phases.step];

  return (
    <>
      <AdminHeader title={`Hello, ${admin.name.split(" ")[0]}`} lead={`Current stage: ${phaseLabel}. Phase 1 ${phases.phase1}, Phase 2 ${phases.phase2}.${finalised ? ` Shortlist finalised ${formatDhaka(finalised)}.` : ""}`} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Teams" value={s.teams} hint={`${s.solo} solo · ${s.duo} duo · ${s.trio} trio`} />
        <Stat label="Participants" value={s.participants} />
        <Stat label="Shortlisted / confirmed" value={`${(s.byStatus.SHORTLISTED ?? 0) + (s.byStatus.CONFIRMED ?? 0)} / ${s.byStatus.CONFIRMED ?? 0}`} />
        <Stat label="Payments to verify" value={s.payments.PENDING_VERIFICATION ?? 0} hint={<Link href="/admin/payments" className="underline">Open payments</Link>} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Showcase teams" value={sc.teams} hint={`${sc.participants} participants`} />
        <Stat label="Showcase to verify" value={sc.pending} hint={<Link href="/admin/showcase?status=PENDING_VERIFICATION" className="underline">Open showcase</Link>} />
        <Stat label="Showcase confirmed" value={sc.confirmed} hint={`${sc.confirmedParticipants} participants`} />
        <Stat label="Showcase fees verified" value={`৳${sc.feesConfirmed}`} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title="Registrations per day (Dhaka time)">
          {s.trend.length === 0 ? (
            <p className="text-sm text-muted">No registrations yet.</p>
          ) : (
            <ul className="grid gap-2">
              {s.trend.map((t) => (
                <li key={t.day} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 text-sm">
                  <span className="font-mono text-muted">{t.day}</span>
                  <span className="h-2.5 rounded-full bg-fg/[0.06]">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(t.n / maxTrend) * 100}%` }} />
                  </span>
                  <span className="text-right font-mono">{t.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Participants by university">
          {s.universities.length === 0 ? (
            <p className="text-sm text-muted">No participants yet.</p>
          ) : (
            <ul className="grid gap-2">
              {s.universities.map((u) => (
                <li key={u.university} className="grid grid-cols-[minmax(0,10rem)_1fr_2.5rem] items-center gap-3 text-sm">
                  <span className="truncate" title={u.university}>
                    {u.university}
                  </span>
                  <span className="h-2.5 rounded-full bg-fg/[0.06]">
                    <span className="block h-full rounded-full bg-secondary" style={{ width: `${(u.n / maxUni) * 100}%` }} />
                  </span>
                  <span className="text-right font-mono">{u.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Team status">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            {["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "NOT_SELECTED", "CONFIRMED", "DISQUALIFIED"].map((k) => (
              <div key={k} className="rounded-xl border border-line p-3">
                <dt className="text-xs text-muted">{k.replace("_", " ").toLowerCase()}</dt>
                <dd className="mt-1 font-mono text-xl">{s.byStatus[k as keyof typeof s.byStatus] ?? 0}</dd>
              </div>
            ))}
          </dl>
        </Section>
        <Section title="Email delivery">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {["QUEUED", "SENT", "FAILED", "DEAD"].map((k) => (
              <div key={k} className="rounded-xl border border-line p-3">
                <dt className="text-xs text-muted">{k.toLowerCase()}</dt>
                <dd className="mt-1 font-mono text-xl">{s.email[k] ?? 0}</dd>
              </div>
            ))}
          </dl>
          {(s.email.DEAD ?? 0) > 0 && <p className="mt-3 text-sm text-danger">Some emails could not be delivered. Check the Emails page.</p>}
          <p className="mt-3 text-sm text-muted">{s.checkedIn} participant(s) checked in.</p>
        </Section>
      </div>
    </>
  );
}
