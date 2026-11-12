import type { Metadata } from "next";
import { Domains } from "@/components/sections/home";
import { Reveal } from "@/components/ui/motion";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { getPublicEvent } from "@/features/event/queries";
import { getCtx } from "@/lib/ctx";

export const metadata: Metadata = { title: "Challenges", description: "Problem domains for CoU AI Hackathon 2026 and how ideas are scored.", alternates: { canonical: "/challenges" } };

const CRITERIA = [
  ["Problem relevance", 20, "Is this a real problem, for real people, worth solving?"],
  ["Innovation", 25, "Is the approach new, or a clear improvement on what exists?"],
  ["AI application", 25, "Is AI essential to the solution and used soundly?"],
  ["Feasibility", 15, "Can a working version be built in the pre-build and the five-hour final?"],
  ["Potential impact", 15, "If it worked, how much would it matter?"],
] as const;

export default async function ChallengesPage() {
  const { settings } = await getPublicEvent(getCtx());
  return (
    <>
      <PageHeader eyebrow="Challenges" title="Pick a problem worth solving" lead="Choose one of the domains below, or make the case for your own under Open Innovation. The detailed problem briefing is given on the day." />
      <section className="section container-page">
        <Domains settings={settings} />
      </section>
      <section className="section border-t border-line bg-surface/30">
        <div className="container-page">
          <Reveal>
            <SectionHeader eyebrow="Phase 1 scoring" title="How ideas are judged" lead="Every idea is scored out of 100 by the review panel. The top 30 teams go through to the on-site round." />
          </Reveal>
          <ul className="mt-12 grid gap-3">
            {CRITERIA.map(([name, points, question], i) => (
              <Reveal as="li" key={name} delay={i * 0.05}>
                <div className="card flex items-center gap-5 p-5 sm:p-6">
                  <span className="w-16 shrink-0 font-mono text-3xl font-semibold text-gradient">{points}</span>
                  <div className="flex-1">
                    <p className="font-semibold">{name}</p>
                    <p className="mt-1 text-sm text-muted">{question}</p>
                  </div>
                  <div aria-hidden className="hidden h-2 w-40 overflow-hidden rounded-full bg-fg/10 sm:block">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${(points / 25) * 100}%` }} />
                  </div>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
