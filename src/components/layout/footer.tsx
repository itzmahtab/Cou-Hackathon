import Image from "next/image";
import Link from "next/link";
import { FOOTER_NAV, NAV, SITE } from "@/config/site";
import { formatPhone, HELPLINE, RULEBOOK_URL } from "@/config/content";

export function Footer({ contactEmail, contactPhone }: { contactEmail: string; contactPhone: string }) {
  return (
    <footer className="border-t border-line bg-surface/40">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Image src="/event-logo-horizontal.png" alt="CoU AI Hackathon 2026" width={1600} height={364} className="logo-adapt h-10 w-auto" />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted">
            The flagship competition of {SITE.parent}, presented by the {SITE.organiser}. 24 November 2026.
          </p>
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-primary-soft">{SITE.tagline}</p>
        </div>
        <nav aria-label="Event">
          <h2 className="text-sm font-semibold text-fg">Event</h2>
          <ul className="mt-4 grid gap-2.5 text-sm text-muted">
            {NAV.map((i) => (
              <li key={i.href}>
                <Link href={i.href} className="hover:text-fg">
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Participants">
          <h2 className="text-sm font-semibold text-fg">Participants</h2>
          <ul className="mt-4 grid gap-2.5 text-sm text-muted">
            {FOOTER_NAV.map((i) => (
              <li key={i.href}>
                <Link href={i.href} className="hover:text-fg">
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm">
            <a href={RULEBOOK_URL} target="_blank" rel="noopener noreferrer" className="block text-muted hover:text-fg">
              Rule book (PDF)
            </a>
            <Link href="/contact#helpline" className="mt-2.5 block text-muted hover:text-fg">
              Helpline: {formatPhone(HELPLINE[0].phone)}
            </Link>
          </p>
          {(contactEmail || contactPhone) && (
            <p className="mt-5 text-sm text-muted">
              {contactEmail && (
                <a href={`mailto:${contactEmail}`} className="block hover:text-fg">
                  {contactEmail}
                </a>
              )}
              {contactPhone && <span className="block">{contactPhone}</span>}
            </p>
          )}
        </nav>
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 {SITE.organiser}.</p>
          <p>Title sponsor Gigabyte AORUS · Powered by IT Palace</p>
        </div>
      </div>
    </footer>
  );
}
