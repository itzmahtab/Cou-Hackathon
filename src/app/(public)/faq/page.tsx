import type { Metadata } from "next";
import Link from "next/link";
import { FaqList } from "@/components/sections/home";
import { PageHeader } from "@/components/ui/page-header";
import { faq, RULEBOOK_URL } from "@/config/content";
import { FileText } from "lucide-react";
import { getPublicEvent } from "@/features/event/queries";
import { getCtx } from "@/lib/ctx";

export const metadata: Metadata = { title: "FAQ", description: "Answers to common questions about registering for and taking part in CoU AI Hackathon 2026.", alternates: { canonical: "/faq" } };

export default async function FaqPage() {
  const { settings } = await getPublicEvent(getCtx());
  const items = faq({ fee: settings.feeBdt, announcement: settings.shortlistAnnouncement });
  const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })) };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PageHeader eyebrow="FAQ" title="Questions, answered" lead="Cannot find what you need? Read the rule book or call the helpline.">
        <div className="mt-7 flex flex-wrap gap-3">
          <a href={RULEBOOK_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            <FileText size={17} aria-hidden /> Rule book (PDF)
          </a>
          <Link href="/contact#helpline" className="btn btn-secondary">
            Helpline numbers
          </Link>
        </div>
      </PageHeader>
      <div className="container-page max-w-3xl py-14 md:py-20">
        <FaqList items={items} />
        <p className="mt-10 text-muted">
          Still stuck? <Link href="/contact" className="text-primary-soft underline underline-offset-4">Contact the organisers</Link>.
        </p>
      </div>
    </>
  );
}
