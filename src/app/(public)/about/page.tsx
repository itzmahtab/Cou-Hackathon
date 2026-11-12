import type { Metadata } from "next";
import { About, FinalCta, Sponsors, Stats, TeamFormation, Timeline } from "@/components/sections/home";
import { PageHeader } from "@/components/ui/page-header";
import { getPublicEvent } from "@/features/event/queries";
import { getCtx } from "@/lib/ctx";

export const metadata: Metadata = { title: "About", description: "What CoU AI Hackathon 2026 is, how the two phases work, and why you should take part.", alternates: { canonical: "/about" } };

export default async function AboutPage() {
  const { settings, phases } = await getPublicEvent(getCtx());
  return (
    <>
      <PageHeader eyebrow="About the hackathon" title={<>From imagination to <span className="text-gradient">innovation.</span></>} lead="CoU AI Hackathon 2026 is an AI competition at Comilla University: shortlisted teams build during a three-day pre-build (21 – 23 November) and finish at a five-hour on-site final on 24 November, organised by the Faculty of Engineering as the flagship event of CoU Technova 2026." />
      <Stats settings={settings} />
      <About />
      <Timeline settings={settings} phases={phases} />
      <TeamFormation settings={settings} />
      <Sponsors />
      <div className="pt-20 md:pt-28">
        <FinalCta phases={phases} />
      </div>
    </>
  );
}
