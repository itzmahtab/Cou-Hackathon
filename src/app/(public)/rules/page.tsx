import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { RULES } from "@/config/content";
import { getPublicEvent } from "@/features/event/queries";
import { getCtx } from "@/lib/ctx";
import { formatDhaka } from "@/lib/time";

export const metadata: Metadata = { title: "Rules and guidelines", description: "Eligibility, team rules, the two registration phases and conduct for CoU AI Hackathon 2026.", alternates: { canonical: "/rules" } };

export default async function RulesPage() {
  const { settings } = await getPublicEvent(getCtx());
  return (
    <>
      <PageHeader eyebrow="Rules and guidelines" title="Play fair. Build boldly." lead="By registering, every team member agrees to these rules." />
      <div className="container-page py-14 md:py-20">
        <dl className="mb-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Phase 1 closes", formatDhaka(settings.phase1CloseAt)],
            ["Shortlist announced", settings.shortlistAnnouncement],
            ["Payment closes", formatDhaka(settings.phase2CloseAt)],
            ["Team fee (shortlisted only)", `BDT ${settings.feeBdt.toLocaleString("en-US")}`],
          ].map(([k, v]) => (
            <div key={k} className="card p-5">
              <dt className="text-xs uppercase tracking-wider text-muted">{k}</dt>
              <dd className="mt-2 font-mono text-sm font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="grid gap-6">
          {RULES.map((group, i) => (
            <section key={group.title} className="card p-6 sm:p-8" aria-labelledby={`rules-${i}`}>
              <h2 id={`rules-${i}`} className="h3">
                <span className="mr-3 font-mono text-base text-primary-soft">{String(i + 1).padStart(2, "0")}</span>
                {group.title}
              </h2>
              <ul className="mt-4 list-disc space-y-2.5 pl-5 leading-relaxed text-muted">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
