import { Mail, MessageCircle, Phone } from "lucide-react";
import { formatPhone, HELPLINE, HELPLINE_EMAIL } from "@/config/content";
import { Reveal } from "@/components/ui/motion";

/** One card per helpline volunteer, with call and WhatsApp buttons, then the helpline email. */
export function HelplineGrid() {
  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {HELPLINE.map((h, i) => (
        <Reveal as="li" key={h.phone} delay={Math.min(i * 0.04, 0.24)}>
          <div className="card flex h-full flex-col p-5">
            <p className="font-semibold">{h.name}</p>
            <p className="mt-1 font-mono text-sm text-muted">{formatPhone(h.phone)}</p>
            <div className="mt-4 flex gap-2">
              <a href={`tel:${h.phone}`} className="btn btn-secondary btn-sm flex-1 px-2" aria-label={`Call ${h.name}`}>
                <Phone size={15} aria-hidden /> Call
              </a>
              <a href={`https://wa.me/${h.phone.replace("+", "")}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm flex-1 px-2" aria-label={`WhatsApp ${h.name}`}>
                <MessageCircle size={15} aria-hidden /> WhatsApp
              </a>
            </div>
          </div>
        </Reveal>
      ))}
    </ul>
    <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
      <Mail size={16} className="text-secondary" aria-hidden />
      Or email us at
      <a href={`mailto:${HELPLINE_EMAIL}`} className="break-all font-semibold text-fg hover:text-primary-soft">
        {HELPLINE_EMAIL}
      </a>
    </p>
    </>
  );
}
