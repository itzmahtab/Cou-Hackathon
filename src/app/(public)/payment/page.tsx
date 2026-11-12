import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { getPublicEvent } from "@/features/event/queries";
import { getCtx } from "@/lib/ctx";
import { formatDhaka } from "@/lib/time";

export const metadata: Metadata = { title: "Payment instructions", description: "How shortlisted teams confirm their place in CoU AI Hackathon 2026.", alternates: { canonical: "/payment" } };

export default async function PaymentPage() {
  const { settings, phases } = await getPublicEvent(getCtx());
  // Numbers are shown only while payment is open, so nobody pays early or late by mistake.
  const showNumbers = phases.phase2 === "open";
  return (
    <>
      <PageHeader eyebrow="Phase 2 · Shortlisted teams only" title="Payment instructions" lead={`Only the ${settings.shortlistCapacity} shortlisted teams pay. Phase 1 registration is free.`} />
      <div className="container-page grid gap-8 py-14 md:py-20 lg:grid-cols-[1.2fr_1fr]">
        <div className="card p-6 sm:p-9">
          <h2 className="h3">How to pay</h2>
          <ol className="mt-5 list-decimal space-y-3 pl-5 leading-relaxed text-muted">
            <li>Wait for the shortlist email. It contains a personal link to your status page.</li>
            <li>
              Open bKash or Nagad and choose <strong className="text-fg">Send Money</strong> (not Payment or Cash Out).
            </li>
            <li>
              Send <strong className="text-fg">BDT {settings.feeBdt.toLocaleString("en-US")}</strong> once, for the whole team. It is not a per-person fee.
            </li>
            <li>Open your status page from the email (or with your registration ID) and submit the method, sender number and transaction ID.</li>
            <li>An organiser checks the transaction by hand. You will get a confirmation email once it is verified.</li>
          </ol>
          <p className="notice notice-warning mt-6">Only send money to the numbers shown on this website during the payment window. Organisers will never ask you to pay a different number by phone.</p>
          <Link href="/status" className="btn btn-primary mt-7">
            Go to my status page
          </Link>
        </div>
        <aside className="grid h-fit gap-4">
          <dl className="card grid gap-4 p-6">
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">Amount</dt>
              <dd className="mt-1 font-mono text-2xl font-semibold">BDT {settings.feeBdt.toLocaleString("en-US")}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">Window</dt>
              <dd className="mt-1 text-sm">
                {formatDhaka(settings.phase2OpenAt)} – {formatDhaka(settings.phase2CloseAt)}
              </dd>
            </div>
            {[
              ["bKash (Send Money)", settings.bkashNumber],
              ["Nagad (Send Money)", settings.nagadNumber],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs uppercase tracking-wider text-muted">{k}</dt>
                <dd className="mt-1 font-mono text-lg font-semibold">{showNumbers && v ? v : phases.phase2 === "before" ? "Shown when payment opens" : showNumbers ? "To be announced" : "Payment window closed"}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </>
  );
}
