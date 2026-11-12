import { Mail, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { getPublicEvent } from "@/features/event/queries";
import { getCtx } from "@/lib/ctx";

export const metadata: Metadata = { title: "Contact", description: "Contact the organisers of CoU AI Hackathon 2026.", alternates: { canonical: "/contact" } };

export default async function ContactPage() {
  const { settings } = await getPublicEvent(getCtx());
  const items = [
    { icon: Mail, label: "Email", value: settings.contactEmail, href: settings.contactEmail ? `mailto:${settings.contactEmail}` : undefined },
    { icon: Phone, label: "Phone", value: settings.contactPhone, href: settings.contactPhone ? `tel:${settings.contactPhone.replace(/[^\d+]/g, "")}` : undefined },
    { icon: MapPin, label: "Venue", value: settings.venue },
  ];
  return (
    <>
      <PageHeader eyebrow="Contact" title="Talk to the organisers" lead="For questions about registration, payment or the event day. Include your registration ID if you have one." />
      <div className="container-page py-14 md:py-20">
        <ul className="grid gap-4 md:grid-cols-3">
          {items.map((i) => (
            <li key={i.label} className="card p-6">
              <i.icon size={22} className="text-secondary" aria-hidden />
              <p className="mt-4 text-xs uppercase tracking-wider text-muted">{i.label}</p>
              {i.value ? (
                i.href ? (
                  <a href={i.href} className="mt-1 block break-all font-semibold hover:text-primary-soft">
                    {i.value}
                  </a>
                ) : (
                  <p className="mt-1 font-semibold">{i.value}</p>
                )
              ) : (
                <p className="mt-1 text-muted">To be announced</p>
              )}
            </li>
          ))}
        </ul>
        {settings.organisers.length > 0 && (
          <section className="mt-16" aria-labelledby="org">
            <h2 id="org" className="h3">
              Organising team
            </h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {settings.organisers.map((o) => (
                <li key={`${o.name}-${o.role}`} className="card p-5">
                  <p className="font-semibold">{o.name}</p>
                  <p className="mt-1 text-sm text-muted">{o.role}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
