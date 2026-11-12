import { ArrowRight, Brain, CalendarDays, Check, ChevronDown, Clock, MapPin, Trophy, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Countdown } from "@/components/ui/countdown";
import { GlowCard, Reveal } from "@/components/ui/motion";
import { SectionHeader } from "@/components/ui/page-header";
import { faq, WHY } from "@/config/content";
import { SITE } from "@/config/site";
import type { Phases, ScheduleItem } from "@/features/event/queries";
import { cn } from "@/lib/cn";
import { PRIZES, type Settings } from "@/lib/settings";
import { formatDhaka, formatDhakaDate } from "@/lib/time";
import { HeroVisual } from "./hero-visual";

const bdt = (n: number) => `BDT ${n.toLocaleString("en-US")}`;
const day = (iso: string) => formatDhaka(iso, { day: "numeric", month: "short" });

export function registrationCta(phases: Phases): { href: string; label: string } {
  if (phases.phase1 === "open") return { href: "/register", label: "Register your team" };
  if (phases.phase1 === "before") return { href: "/register", label: "Registration opens soon" };
  return { href: "/status", label: "Check your status" };
}

export function Hero({ settings, phases }: { settings: Settings; phases: Phases }) {
  const cta = registrationCta(phases);
  return (
    <section className="relative isolate flex min-h-[100svh] items-center overflow-hidden pt-24">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="bg-grid absolute inset-0" />
        <div className="animate-drift absolute -left-40 top-10 h-[34rem] w-[34rem] rounded-full bg-primary/25 blur-[130px]" />
        <div className="animate-drift absolute -right-40 bottom-0 h-[30rem] w-[30rem] rounded-full bg-secondary/20 blur-[130px] [animation-delay:-8s]" />
        <HeroVisual />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-bg to-transparent" />
      </div>
      <div className="container-page relative py-16">
        <Reveal>
          <p className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted sm:text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary shadow-[0_0_10px_2px] shadow-secondary/70" />
            {SITE.parent} · Faculty of Engineering
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="h-display mt-7 max-w-5xl">
            BUILD THE FUTURE. <span className="text-gradient">IN FIVE HOURS.</span>
          </h1>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="lead mt-7">
            CoU AI Hackathon 2026 brings student builders to Comilla University for one focused sprint: an idea, a team of up to three, and five hours to make it real.
          </p>
        </Reveal>
        <Reveal delay={0.22}>
          <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-fg">
            <li className="flex items-center gap-2">
              <CalendarDays size={17} className="text-primary-soft" aria-hidden /> {formatDhakaDate(settings.eventStartAt)}
            </li>
            <li className="flex items-center gap-2">
              <MapPin size={17} className="text-primary-soft" aria-hidden /> {settings.venue}
            </li>
            <li className="flex items-center gap-2">
              <Trophy size={17} className="text-primary-soft" aria-hidden /> {bdt(25000)} prize pool
            </li>
          </ul>
        </Reveal>
        <Reveal delay={0.28}>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href={cta.href} className="btn btn-primary">
              {cta.label} <ArrowRight size={18} aria-hidden />
            </Link>
            <Link href="#about" className="btn btn-secondary">
              Explore the event
            </Link>
          </div>
        </Reveal>
        <Reveal delay={0.36} className="mt-12">
          <Countdown target={settings.eventStartAt} />
        </Reveal>
      </div>
    </section>
  );
}

export function Sponsors() {
  return (
    <section aria-label="Sponsors" className="border-y border-line bg-surface/40">
      <div className="container-page flex flex-col items-center justify-center gap-8 py-10 sm:flex-row sm:gap-14">
        <figure className="flex flex-col items-center gap-3">
          <figcaption className="eyebrow text-muted">Title sponsor</figcaption>
          <Image src="/sponsors/Gigabyte_aorus_logos_dark_bg.png" alt="Gigabyte AORUS" width={4135} height={603} className="h-12 w-auto rounded-lg sm:h-14" />
        </figure>
        <div aria-hidden className="hidden h-14 w-px bg-line sm:block" />
        <figure className="flex flex-col items-center gap-3">
          <figcaption className="eyebrow text-muted">Powered by</figcaption>
          <span className="rounded-lg bg-white px-4 py-2.5">
            <Image src="/sponsors/ITP-2.png" alt="IT Palace, Kandirpar, Cumilla" width={1693} height={393} className="h-8 w-auto sm:h-9" />
          </span>
        </figure>
      </div>
    </section>
  );
}

export function Stats({ settings }: { settings: Settings }) {
  const stats = [
    { icon: Clock, value: "5", unit: "hours", label: "to build a working solution" },
    { icon: Trophy, value: "25,000", unit: "BDT", label: "total prize pool" },
    { icon: Brain, value: String(settings.shortlistCapacity), unit: "teams", label: "selected for the on-site round" },
    { icon: Users, value: "1–3", unit: "people", label: "per team, any university" },
  ];
  return (
    <section className="container-page py-16 md:py-24">
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal as="li" key={s.label} delay={i * 0.06}>
            <div className="card h-full p-5 sm:p-7">
              <s.icon size={22} className="text-secondary" aria-hidden />
              <p className="mt-5 font-mono text-3xl font-semibold tracking-tight sm:text-5xl">
                {s.value} <span className="text-sm font-normal text-muted sm:text-base">{s.unit}</span>
              </p>
              <p className="mt-2 text-sm text-muted">{s.label}</p>
            </div>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

export function About() {
  return (
    <section id="about" className="section container-page">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
        <Reveal>
          <SectionHeader
            eyebrow="About the hackathon"
            title={
              <>
                Not just five hours of coding. Five hours in which an idea <span className="text-gradient">gets the chance to become real.</span>
              </>
            }
          />
          <div className="mt-6 space-y-4 text-muted">
            <p className="leading-relaxed">
              CoU AI Hackathon 2026 is an on-site competition hosted by the Faculty of Engineering at Comilla University. It is the flagship event of CoU Technova 2026, the university&apos;s AI and technology carnival.
            </p>
            <p className="leading-relaxed">
              It runs in two phases. First, every team submits an idea, free of charge. Reviewers score each one, and the strongest 30 are invited to campus to build it.
            </p>
          </div>
          <Link href="/about" className="btn btn-secondary mt-8">
            More about the event <ArrowRight size={17} aria-hidden />
          </Link>
        </Reveal>
        <ul className="grid gap-4 sm:grid-cols-2">
          {WHY.map((w, i) => (
            <Reveal as="li" key={w.title} delay={i * 0.05}>
              <GlowCard className="h-full p-6">
                <h3 className="text-base font-semibold">{w.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{w.body}</p>
              </GlowCard>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function timelineSteps(settings: Settings) {
  return [
    { when: `${day(settings.phase1OpenAt)} – ${day(settings.phase1CloseAt)}`, title: "Phase 1: Pre-registration", body: "Register your team and submit your idea. Free.", href: "/register" },
    { when: settings.shortlistAnnouncement.replace(/ 2026$/, ""), title: "Evaluation and shortlist", body: `Reviewers score every idea. The top ${settings.shortlistCapacity} teams are announced by email.`, href: "/status" },
    { when: `${day(settings.phase2OpenAt)} – ${day(settings.phase2CloseAt)}`, title: "Phase 2: Payment and confirmation", body: `Shortlisted teams pay ${bdt(settings.feeBdt)} per team and are confirmed.`, href: "/payment" },
    { when: day(settings.eventStartAt), title: "Hackathon day", body: "Five hours on campus. Build, present, win.", href: "/schedule" },
  ];
}

export function Timeline({ settings, phases }: { settings: Settings; phases: Phases }) {
  const steps = timelineSteps(settings);
  return (
    <section className="section border-y border-line bg-surface/30">
      <div className="container-page">
        <Reveal>
          <SectionHeader eyebrow="Registration timeline" title="Four dates to remember" lead="All times are Bangladesh Standard Time. Each window closes at 11:59 pm on its last day." />
        </Reveal>
        <ol className="mt-12 grid gap-4 lg:grid-cols-4">
          {steps.map((s, i) => {
            const state = i < phases.step ? "done" : i === phases.step ? "current" : "upcoming";
            return (
              <Reveal as="li" key={s.title} delay={i * 0.07}>
                <GlowCard lit={state === "current"} className={cn("flex h-full flex-col p-6", state === "done" && "opacity-60")}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-sm text-secondary">{s.when}</span>
                    {state === "current" && <span className="badge badge-primary">Now</span>}
                    {state === "done" && (
                      <span className="badge badge-neutral">
                        <Check size={12} aria-hidden /> Done
                      </span>
                    )}
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{s.body}</p>
                  <p className="mt-5 font-mono text-xs text-muted">Step {i + 1} of 4</p>
                </GlowCard>
              </Reveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

export function Domains({ settings, compact }: { settings: Settings; compact?: boolean }) {
  return (
    <ul className={cn("grid gap-4 sm:grid-cols-2", !compact && "lg:grid-cols-3")}>
      {settings.domains.map((d, i) => (
        <Reveal as="li" key={d.title} delay={i * 0.05}>
          <GlowCard className="h-full p-6">
            <span className="font-mono text-xs text-primary-soft">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="mt-3 text-lg font-semibold">{d.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{d.description}</p>
          </GlowCard>
        </Reveal>
      ))}
    </ul>
  );
}

const PRIZE_STYLE = [
  { ring: "border-gold/40", text: "text-gold", glow: "shadow-[0_0_70px_-20px] shadow-gold/60", order: "md:order-2 md:-translate-y-6" },
  { ring: "border-silver/30", text: "text-silver", glow: "", order: "md:order-1" },
  { ring: "border-bronze/40", text: "text-bronze", glow: "", order: "md:order-3" },
];

export function PrizeCards() {
  return (
    <ul className="grid gap-4 md:grid-cols-3 md:items-end">
      {PRIZES.map((p, i) => (
        <Reveal as="li" key={p.position} delay={i * 0.08} className={PRIZE_STYLE[i].order}>
          <div className={cn("card glow-card p-8 text-center", PRIZE_STYLE[i].ring, PRIZE_STYLE[i].glow)}>
            <Trophy size={34} className={cn("mx-auto", PRIZE_STYLE[i].text)} aria-hidden />
            <p className="mt-5 text-sm font-medium uppercase tracking-[0.16em] text-muted">{p.label}</p>
            <p className={cn("mt-3 font-mono text-4xl font-semibold tracking-tight sm:text-5xl", PRIZE_STYLE[i].text)}>{p.amountBdt.toLocaleString("en-US")}</p>
            <p className="mt-1 text-sm text-muted">BDT</p>
          </div>
        </Reveal>
      ))}
    </ul>
  );
}

export function ScheduleList({ items }: { items: ScheduleItem[] }) {
  return (
    <ol className="relative grid gap-3 before:absolute before:bottom-4 before:left-[7px] before:top-4 before:w-px before:bg-line">
      {items.map((item, i) => (
        <Reveal as="li" key={item.id} delay={Math.min(i * 0.04, 0.3)} className="relative pl-9">
          <span aria-hidden className="absolute left-0 top-6 h-[15px] w-[15px] rounded-full border-2 border-primary bg-bg" />
          <div className="card flex flex-col gap-1 p-5 sm:flex-row sm:items-baseline sm:gap-6">
            <p className="shrink-0 font-mono text-sm text-secondary sm:w-48">{item.timeLabel}</p>
            <div>
              <h3 className="font-semibold">{item.title}</h3>
              {item.description && <p className="mt-1 text-sm leading-relaxed text-muted">{item.description}</p>}
            </div>
          </div>
        </Reveal>
      ))}
    </ol>
  );
}

export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <details key={item.q} className="card group px-6 py-1 open:bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-medium [&::-webkit-details-marker]:hidden">
            {item.q}
            <ChevronDown size={18} className="shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden />
          </summary>
          <p className="pb-5 leading-relaxed text-muted">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

export function TeamFormation({ settings }: { settings: Settings }) {
  const options = [
    { n: "1", title: "Solo", body: "Confident on your own? Register alone and own every decision." },
    { n: "2", title: "Duo", body: "One builds the model, one builds the product. A classic split." },
    { n: "3", title: "Trio", body: "The maximum. Enough hands for model, product and pitch." },
  ];
  return (
    <section className="section container-page">
      <Reveal>
        <SectionHeader eyebrow="Team formation" title="Come alone or bring two friends" lead={`Teams of one, two or three. Members can come from different universities. If shortlisted, the fee is ${bdt(settings.feeBdt)} for the whole team.`} />
      </Reveal>
      <ul className="mt-12 grid gap-4 md:grid-cols-3">
        {options.map((o, i) => (
          <Reveal as="li" key={o.title} delay={i * 0.07}>
            <GlowCard className="h-full p-7">
              <p className="font-mono text-6xl font-semibold text-gradient">{o.n}</p>
              <h3 className="mt-4 text-lg font-semibold">{o.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{o.body}</p>
            </GlowCard>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

export function FinalCta({ phases }: { phases: Phases }) {
  const cta = registrationCta(phases);
  return (
    <section className="container-page pb-24 md:pb-32">
      <Reveal>
        <div className="card glow-card is-lit relative overflow-hidden px-6 py-16 text-center sm:px-12 md:py-24">
          <div aria-hidden className="absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-0 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-primary/30 blur-[110px]" />
          </div>
          <p className="eyebrow">Your idea could change tomorrow</p>
          <h2 className="h1 mx-auto mt-4 max-w-3xl">Build beyond imagination.</h2>
          <p className="lead mx-auto mt-5">Phase 1 is free and takes about ten minutes. All you need is a team, a student ID and an idea worth five hours.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href={cta.href} className="btn btn-primary">
              {cta.label} <ArrowRight size={18} aria-hidden />
            </Link>
            <Link href="/rules" className="btn btn-secondary">
              Read the rules
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function HomeFaq({ settings }: { settings: Settings }) {
  return (
    <section className="section border-t border-line bg-surface/30">
      <div className="container-page grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal>
          <SectionHeader eyebrow="FAQ" title="Questions, answered" lead="The short version. The full list is on the FAQ page." />
          <Link href="/faq" className="btn btn-secondary mt-8">
            All questions <ArrowRight size={17} aria-hidden />
          </Link>
        </Reveal>
        <Reveal delay={0.1}>
          <FaqList items={faq({ fee: settings.feeBdt, announcement: settings.shortlistAnnouncement }).slice(0, 6)} />
        </Reveal>
      </div>
    </section>
  );
}
