import { Award, CalendarDays, Cookie, ExternalLink, Gift, GraduationCap, Mail, MapPin, MessageCircle, Phone, Ticket, Users } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { GlowCard, Reveal } from "@/components/ui/motion";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { formatPhone } from "@/config/content";
import { SHOWCASE } from "@/config/showcase";

export const metadata: Metadata = {
  title: "Project Showcase Competition",
  description: "CoU Technova 2026 Project Showcase Competition for Comilla University students. 23 November 2026. Register 13 – 22 November, BDT 50 per participant.",
  alternates: { canonical: "/showcase" },
};

const BENEFIT_ICONS = [GraduationCap, Cookie, Gift];

export default function ShowcasePage() {
  const facts = [
    { icon: CalendarDays, label: "Event date", value: SHOWCASE.eventDate },
    { icon: Ticket, label: "Registration", value: `${SHOWCASE.registrationOpens.replace(" 2026", "")} – ${SHOWCASE.registrationCloses}` },
    { icon: Award, label: "Fee", value: `BDT ${SHOWCASE.feeBdt} per participant` },
    { icon: Users, label: "Team size", value: `Up to ${SHOWCASE.maxTeam} members` },
    { icon: MapPin, label: "Venue", value: SHOWCASE.venue },
    { icon: GraduationCap, label: "Who can join", value: SHOWCASE.eligibility },
  ];

  return (
    <>
      <PageHeader
        eyebrow="CoU Technova 2026 · Project Showcase"
        title={
          <>
            Project Showcase <span className="text-gradient">Competition</span>
          </>
        }
        lead={SHOWCASE.intro}
      >
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <span className="badge badge-warning px-3 py-1 text-sm">
            <GraduationCap size={15} aria-hidden /> Comilla University students only
          </span>
          <span className="badge badge-neutral px-3 py-1 text-sm">Separate from the AI Hackathon</span>
        </div>
      </PageHeader>

      <section className="container-page py-14 md:py-20" aria-label="Key details">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map((f, i) => (
            <Reveal as="li" key={f.label} delay={i * 0.05}>
              <div className="card flex h-full items-start gap-4 p-6">
                <f.icon size={22} className="mt-0.5 shrink-0 text-secondary" aria-hidden />
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted">{f.label}</p>
                  <p className="mt-1 text-lg font-semibold">{f.value}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ul>
      </section>

      <section className="section border-y border-line bg-surface/30">
        <div className="container-page">
          <Reveal>
            <SectionHeader eyebrow="Project categories" title="Bring what you have built" lead="Projects, prototypes and research ideas are all welcome. Pick the category that fits best." />
          </Reveal>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SHOWCASE.categories.map((c, i) => (
              <Reveal as="li" key={c.title} delay={Math.min(i * 0.05, 0.3)}>
                <GlowCard className="h-full p-6">
                  <span className="font-mono text-xs text-primary-soft">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-3 text-lg font-semibold">{c.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{c.body}</p>
                </GlowCard>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="section container-page">
        <Reveal>
          <SectionHeader eyebrow="Participation benefits" title="Everyone takes something home" />
        </Reveal>
        <ul className="mt-12 grid gap-4 md:grid-cols-3">
          {SHOWCASE.benefits.map((b, i) => {
            const Icon = BENEFIT_ICONS[i];
            return (
              <Reveal as="li" key={b.title} delay={i * 0.07}>
                <GlowCard lit={i === 2} className="h-full p-7 text-center">
                  <Icon size={32} className="mx-auto text-gold" aria-hidden />
                  <h3 className="mt-4 text-lg font-semibold">{b.title}</h3>
                  <p className="mt-1 text-muted">{b.body}</p>
                </GlowCard>
              </Reveal>
            );
          })}
        </ul>
      </section>

      <section className="section border-y border-line bg-surface/30">
        <div className="container-page grid gap-10 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <SectionHeader eyebrow="How to take part" title="Register by 22 November" />
            <ol className="mt-6 list-decimal space-y-2 pl-5 leading-relaxed text-muted">
              <li>Form a team of up to {SHOWCASE.maxTeam} Comilla University students, or take part alone.</li>
              <li>Register between {SHOWCASE.registrationOpens} and {SHOWCASE.registrationCloses}.</li>
              <li>
                Pay BDT {SHOWCASE.feeBdt} per participant by <strong className="text-fg">bKash Send Money</strong> to <strong className="whitespace-nowrap font-mono text-fg">{formatPhone(SHOWCASE.bkash)}</strong> (a team of four pays BDT {SHOWCASE.feeBdt * 4}). Keep the transaction ID for the registration form.
              </li>
              <li>Bring your project to {SHOWCASE.venue} on {SHOWCASE.eventDate}. Carry your student ID card.</li>
            </ol>
            {SHOWCASE.registrationUrl ? (
              <a href={SHOWCASE.registrationUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-7">
                Register for the showcase <ExternalLink size={16} aria-hidden />
              </a>
            ) : (
              <p className="notice notice-info mt-6">The registration form opens on {SHOWCASE.registrationOpens}. Until then, contact the organisers below.</p>
            )}
          </Reveal>
          <Reveal delay={0.1}>
            <div className="card mb-5 border-primary/40 p-7">
              <p className="eyebrow text-muted">Showcase fee</p>
              <p className="mt-2 font-mono text-4xl font-semibold">BDT {SHOWCASE.feeBdt}</p>
              <p className="text-sm text-muted">per participant</p>
              <dl className="mt-5 grid gap-1 text-sm">
                <dt className="text-xs uppercase tracking-wider text-muted">bKash (Send Money)</dt>
                <dd className="font-mono text-lg font-semibold">{formatPhone(SHOWCASE.bkash)}</dd>
              </dl>
              <p className="mt-4 text-xs text-muted">This number is for the Project Showcase only, not the AI Hackathon.</p>
            </div>
            <div className="card p-7 text-center">
              <p className="eyebrow text-muted">Organised by</p>
              <p className="mt-2 font-semibold">{SHOWCASE.organiser}</p>
              <p className="eyebrow mt-7 text-muted">Title sponsors</p>
              <div className="mt-4 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
                <Image src="/sponsors/Gigabyte_aorus_logos_dark_bg.png" alt="Gigabyte" width={4135} height={603} className="h-10 w-auto rounded-lg" />
                <span className="rounded-lg bg-white px-3 py-2">
                  <Image src="/sponsors/ITP-2.png" alt="IT Palace" width={1693} height={393} className="h-7 w-auto" />
                </span>
              </div>
              <p className="mt-7 font-mono text-xs uppercase tracking-[0.16em] text-primary-soft">{SHOWCASE.tagline}</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="contact" className="section container-page">
        <Reveal>
          <SectionHeader eyebrow="Contact" title="Questions about the showcase?" lead="Call or WhatsApp the showcase organisers, or send an email." />
        </Reveal>
        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SHOWCASE.contacts.map((c) => (
            <li key={c.phone} className="card flex flex-col p-5">
              <p className="font-semibold">
                {c.name} <span className="font-normal text-muted">· {c.dept}</span>
              </p>
              <p className="mt-1 font-mono text-sm text-muted">{formatPhone(c.phone)}</p>
              <div className="mt-4 flex gap-2">
                <a href={`tel:${c.phone}`} className="btn btn-secondary btn-sm flex-1 px-2" aria-label={`Call ${c.name}`}>
                  <Phone size={15} aria-hidden /> Call
                </a>
                <a href={`https://wa.me/${c.phone.replace("+", "")}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm flex-1 px-2" aria-label={`WhatsApp ${c.name}`}>
                  <MessageCircle size={15} aria-hidden /> WhatsApp
                </a>
              </div>
            </li>
          ))}
          <li className="card flex flex-col p-5">
            <p className="font-semibold">Email</p>
            <p className="mt-1 break-all text-sm text-muted">{SHOWCASE.email}</p>
            <a href={`mailto:${SHOWCASE.email}?subject=Project%20Showcase%20Competition`} className="btn btn-secondary btn-sm mt-4">
              <Mail size={15} aria-hidden /> Send email
            </a>
          </li>
        </ul>
        <p className="mt-10 text-sm text-muted">
          Looking for the AI Hackathon (open to all universities)?{" "}
          <Link href="/" className="text-primary-soft underline underline-offset-4">
            Go to the hackathon home page
          </Link>
          .
        </p>
      </section>
    </>
  );
}
