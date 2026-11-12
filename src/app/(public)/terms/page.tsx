import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Terms and conditions", description: "Terms for registering for and taking part in CoU AI Hackathon 2026.", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Terms and conditions" lead="Last updated 12 November 2026." />
      <div className="container-page py-14 md:py-20">
        <div className="prose-page">
          <p>By registering for CoU AI Hackathon 2026 you agree to these terms and to the <Link href="/rules">event rules</Link>.</p>
          <h2>Registration</h2>
          <ul>
            <li>You must give accurate information. False information can lead to disqualification at any stage.</li>
            <li>Registering does not guarantee a place. Only shortlisted teams that complete payment are confirmed.</li>
            <li>The organisers may change dates, the venue or the schedule. Registered teams will be told by email.</li>
          </ul>
          <h2>Payment and refunds</h2>
          <ul>
            <li>The team fee is paid only after shortlisting and is per team.</li>
            <li>The fee is not refundable once your place is confirmed, except where the organisers cancel the event.</li>
            <li>A payment sent to a number not shown on this website is not our responsibility.</li>
          </ul>
          <h2>Intellectual property</h2>
          <p>Teams keep ownership of their ideas and code. By taking part you allow the organisers to show your team name, project title and a short description in event materials and results.</p>
          <h2>Photos</h2>
          <p>The event will be photographed and filmed. Tell the organisers at check-in if you do not wish to appear.</p>
          <h2>Liability</h2>
          <p>You are responsible for your own equipment. The organisers are not liable for loss or damage to personal belongings.</p>
          <h2>Data</h2>
          <p>We handle your data as described in the <Link href="/privacy">privacy policy</Link>.</p>
        </div>
      </div>
    </>
  );
}
