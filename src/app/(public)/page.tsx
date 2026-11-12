import { ArrowRight, Megaphone } from "lucide-react";
import Link from "next/link";
import { About, Domains, FinalCta, Hero, HomeFaq, PrizeCards, ScheduleList, Sponsors, Stats, TeamFormation, Timeline } from "@/components/sections/home";
import { Reveal } from "@/components/ui/motion";
import { SectionHeader } from "@/components/ui/page-header";
import { RULES } from "@/config/content";
import { SITE } from "@/config/site";
import { getAnnouncements, getPublicEvent, getSchedule } from "@/features/event/queries";
import { getCtx } from "@/lib/ctx";
import { formatDhaka } from "@/lib/time";

export default async function HomePage() {
  const ctx = getCtx();
  const [{ settings, phases }, schedule, news] = await Promise.all([getPublicEvent(ctx), getSchedule(ctx), getAnnouncements(ctx, 3)]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Hackathon",
    name: SITE.name,
    description: SITE.description,
    startDate: settings.eventStartAt,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: { "@type": "Place", name: "Comilla University", address: { "@type": "PostalAddress", addressLocality: "Cumilla", addressCountry: "BD" } },
    organizer: { "@type": "Organization", name: SITE.organiser },
    url: SITE.url,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Hero settings={settings} phases={phases} />
      <Sponsors />
      {news.length > 0 && (
        <section aria-label="Announcements" className="container-page pt-12">
          <ul className="grid gap-3">
            {news.map((n) => (
              <li key={n.id} className="notice notice-info flex gap-3">
                <Megaphone size={18} className="mt-0.5 shrink-0 text-secondary" aria-hidden />
                <div>
                  <p className="font-semibold">{n.title}</p>
                  <p className="mt-1 whitespace-pre-line text-muted">{n.body}</p>
                  {n.publishedAt && <p className="mt-2 font-mono text-xs text-muted">{formatDhaka(n.publishedAt)}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Stats settings={settings} />
      <About />
      <Timeline settings={settings} phases={phases} />

      <section className="section container-page">
        <Reveal>
          <SectionHeader eyebrow="Problem domains" title="Pick a problem worth solving" lead="Choose a domain, or argue for your own. What matters is a real problem and a sound use of AI." />
        </Reveal>
        <div className="mt-12">
          <Domains settings={settings} />
        </div>
      </section>

      <section className="section border-y border-line bg-surface/30">
        <div className="container-page">
          <Reveal>
            <SectionHeader center eyebrow="Prizes" title={<>BDT 25,000 on the table</>} lead="Three teams leave with a prize. Every team leaves with something built." />
          </Reveal>
          <div className="mt-16">
            <PrizeCards />
          </div>
        </div>
      </section>

      <TeamFormation settings={settings} />

      <section className="section border-y border-line bg-surface/30">
        <div className="container-page grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <SectionHeader eyebrow="Hackathon day" title="How the day runs" lead={`${formatDhaka(settings.eventStartAt, { weekday: "long", day: "numeric", month: "long" })} at ${settings.venue}.`} />
            <Link href="/schedule" className="btn btn-secondary mt-8">
              Full schedule <ArrowRight size={17} aria-hidden />
            </Link>
          </Reveal>
          <ScheduleList items={schedule.slice(0, 5)} />
        </div>
      </section>

      <section className="section container-page">
        <Reveal>
          <SectionHeader eyebrow="Rules" title="The rules, in brief" />
        </Reveal>
        <ul className="mt-10 grid gap-4 md:grid-cols-2">
          {RULES.slice(0, 4).map((group, i) => (
            <Reveal as="li" key={group.title} delay={i * 0.05}>
              <div className="card h-full p-6">
                <h3 className="font-semibold">{group.title}</h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
                  {group.items.slice(0, 3).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </ul>
        <Link href="/rules" className="btn btn-secondary mt-8">
          Read all rules <ArrowRight size={17} aria-hidden />
        </Link>
      </section>

      <HomeFaq settings={settings} />

      {settings.organisers.length > 0 && (
        <section className="section container-page">
          <Reveal>
            <SectionHeader eyebrow="Organising team" title="The people behind the event" />
          </Reveal>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {settings.organisers.map((o) => (
              <li key={`${o.name}-${o.role}`} className="card p-5">
                <p className="font-semibold">{o.name}</p>
                <p className="mt-1 text-sm text-muted">{o.role}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="pt-20 md:pt-28">
        <FinalCta phases={phases} />
      </div>
    </>
  );
}
