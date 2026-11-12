import type { Metadata } from "next";
import Link from "next/link";
import { FaqList } from "@/components/sections/home";
import { PageHeader } from "@/components/ui/page-header";
import { faq } from "@/config/content";
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
      <PageHeader eyebrow="FAQ" title="Questions, answered" lead="Cannot find what you need? Get in touch through the contact page." />
      <div className="container-page max-w-3xl py-14 md:py-20">
        <FaqList items={items} />
        <p className="mt-10 text-muted">
          Still stuck? <Link href="/contact" className="text-primary-soft underline underline-offset-4">Contact the organisers</Link>.
        </p>
      </div>
    </>
  );
}
