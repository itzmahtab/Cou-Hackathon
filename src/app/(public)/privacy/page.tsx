import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Privacy policy", description: "How CoU AI Hackathon 2026 collects, uses and deletes participant data.", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Privacy policy" lead="Last updated 12 November 2026." />
      <div className="container-page py-14 md:py-20">
        <div className="prose-page">
          <p>This policy explains what the Faculty of Engineering, Comilla University (&ldquo;we&rdquo;) collects through this website for CoU AI Hackathon 2026, why, and how long we keep it.</p>
          <h2>What we collect</h2>
          <ul>
            <li><strong>About each participant:</strong> full name, email address, phone and WhatsApp numbers, university, student ID number, T-shirt size and a photo of the student ID card.</li>
            <li><strong>About each team:</strong> team name, idea title and description, and the idea document you upload.</li>
            <li><strong>For shortlisted teams:</strong> payment method, sender number, transaction ID, amount and, if provided, a payment screenshot.</li>
            <li><strong>Technical data:</strong> IP address, used only for abuse prevention and rate limiting.</li>
          </ul>
          <h2>Why we collect it</h2>
          <ul>
            <li>To verify that participants are students and that each person registers only once.</li>
            <li>To review ideas and select the shortlisted teams.</li>
            <li>To verify payments and confirm places.</li>
            <li>To send event emails: confirmations, selection results, payment updates, reminders and results.</li>
            <li>To run check-in and provide T-shirts on the day.</li>
          </ul>
          <h2>Who can see it</h2>
          <p>Only authorised organisers, each limited to what their role needs. Reviewers see idea content, not contact details or ID cards. Payment staff see payment details, not review notes. Every access to an uploaded document is logged.</p>
          <p>The public website shows only team names, universities, project titles and, after the event, published results. Emails, phone numbers, student IDs and documents are never published.</p>
          <p>Files are stored in private Cloudflare R2 storage and the database in Cloudflare D1. Emails are delivered through a transactional email provider. We do not sell or share your data for marketing.</p>
          <h2>How long we keep it</h2>
          <ul>
            <li>Student ID card images and payment screenshots: deleted 30 days after the event.</li>
            <li>Contact details: deleted 90 days after the event.</li>
            <li>Team name, universities, idea title and published results: kept as an event record.</li>
          </ul>
          <h2>Your rights</h2>
          <p>You can ask to see, correct or delete your data by contacting the organisers through the contact page. Deleting a participant before the event withdraws the team&apos;s registration if the team would no longer be valid.</p>
        </div>
      </div>
    </>
  );
}
