import { Check, Circle, CircleDot, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import QRCode from "qrcode";
import { PaymentForm, StatusLookup } from "@/components/forms/status-forms";
import { PageHeader } from "@/components/ui/page-header";
import { getTeamStatus, readStatusCookie, STATUS_COOKIE, type Stage, type TeamStatusView } from "@/features/status/service";
import { cn } from "@/lib/cn";
import { getCtx } from "@/lib/ctx";
import { formatDhaka, formatDhakaDate } from "@/lib/time";

export const metadata: Metadata = { title: "Registration status", description: "Check where your team stands in CoU AI Hackathon 2026.", alternates: { canonical: "/status" }, robots: { index: false } };

const STEPS = ["Registered", "Idea review", "Shortlist", "Payment", "Confirmed"];
const PROGRESS: Record<Stage, number> = { SUBMITTED: 1, UNDER_REVIEW: 1, NOT_SELECTED: 2, PAYMENT_PENDING: 3, PAYMENT_VERIFICATION: 3, CONFIRMED: 5, DISQUALIFIED: 0 };

function headline(s: TeamStatusView): { badge: string; tone: string; title: string; body: string } {
  const deadline = formatDhaka(s.settings.phase2CloseAt);
  switch (s.stage) {
    case "SUBMITTED":
      return { badge: "Submitted", tone: "badge-info", title: "We have your registration.", body: `Reviewers will score your idea after Phase 1 closes. Results are emailed on ${s.settings.shortlistAnnouncement}.` };
    case "UNDER_REVIEW":
      return { badge: "Under review", tone: "badge-info", title: "Your idea is being reviewed.", body: `Results are emailed to every team member on ${s.settings.shortlistAnnouncement}.` };
    case "NOT_SELECTED":
      return { badge: "Not selected", tone: "badge-neutral", title: "Your team was not shortlisted this time.", body: "There were more strong ideas than places. Thank you for taking part, and keep building." };
    case "PAYMENT_PENDING":
      return s.phase2 === "before"
        ? { badge: "Shortlisted", tone: "badge-success", title: "You are shortlisted.", body: `The payment window opens on ${formatDhaka(s.settings.phase2OpenAt)} and closes on ${deadline}.` }
        : s.phase2 === "closed"
          ? { badge: "Payment window closed", tone: "badge-danger", title: "The payment window has closed.", body: "Contact the organisers if you believe this is a mistake." }
          : { badge: "Payment pending", tone: "badge-warning", title: "You are shortlisted. Confirm your place.", body: `Send the team fee and submit the transaction ID below before ${deadline}.` };
    case "PAYMENT_VERIFICATION":
      return { badge: "Verifying payment", tone: "badge-warning", title: "We are checking your payment.", body: "An organiser verifies each transaction by hand. This can take up to a day. You will get an email when it is done." };
    case "CONFIRMED":
      return { badge: "Confirmed", tone: "badge-success", title: "Your place is confirmed.", body: `See you on ${formatDhakaDate(s.settings.eventStartAt)} at ${s.settings.venue}. Bring your student ID card.` };
    case "DISQUALIFIED":
      return { badge: "Disqualified", tone: "badge-danger", title: "This registration has been disqualified.", body: "Contact the organisers for details." };
  }
}

export default async function StatusPage({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const ctx = getCtx();
  const { link } = await searchParams;
  const teamId = await readStatusCookie(ctx, (await cookies()).get(STATUS_COOKIE)?.value);
  const status = teamId ? await getTeamStatus(ctx, teamId) : null;

  if (!status) {
    return (
      <>
        <PageHeader eyebrow="Registration status" title="Where does my team stand?" lead="Enter your registration ID and a team member's email. We will send a one-time code to that address." />
        <div className="container-page py-12 md:py-16">
          {link === "invalid" && <p className="notice notice-warning mx-auto mb-6 max-w-lg">That link is not valid or has expired. Use your registration ID and email instead.</p>}
          <StatusLookup turnstileSiteKey={ctx.env.TURNSTILE_SITE_KEY} />
        </div>
      </>
    );
  }

  const h = headline(status);
  const progress = PROGRESS[status.stage];
  const stopped = status.stage === "NOT_SELECTED" || status.stage === "DISQUALIFIED";
  const qr = status.stage === "CONFIRMED" ? await QRCode.toString(`${ctx.env.APP_URL}/admin/event?q=${status.registrationId}`, { type: "svg", margin: 1, color: { dark: "#070812", light: "#ffffff" } }) : null;
  const rejected = status.payment?.status === "REJECTED";

  return (
    <>
      <PageHeader eyebrow="Registration status" title={status.teamName}>
        <p className="mt-4 font-mono text-sm text-muted">
          {status.registrationId} · {status.members.join(", ")}
        </p>
      </PageHeader>
      <div className="container-page grid gap-8 py-12 md:py-16 lg:grid-cols-[1fr_1.3fr]">
        <section aria-label="Progress" className="card h-fit p-6 sm:p-8">
          <ol className="grid gap-5">
            {STEPS.map((label, i) => {
              const done = i < progress;
              const current = i === progress && !stopped;
              const failedHere = stopped && i === progress;
              return (
                <li key={label} className="flex items-center gap-3" aria-current={current ? "step" : undefined}>
                  {failedHere ? <XCircle size={22} className="text-danger" aria-hidden /> : done ? <Check size={22} className="text-success" aria-hidden /> : current ? <CircleDot size={22} className="text-primary-soft" aria-hidden /> : <Circle size={22} className="text-muted/50" aria-hidden />}
                  <span className={cn("text-sm", done || current ? "font-medium text-fg" : "text-muted")}>{label}</span>
                  <span className="sr-only">{done ? "(done)" : current ? "(current)" : failedHere ? "(not reached)" : "(upcoming)"}</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-7 border-t border-line pt-5 text-sm text-muted">
            Idea: <span className="text-fg">{status.ideaTitle}</span>
          </p>
        </section>

        <section aria-label="Current status" className="grid gap-6">
          <div className="card p-6 sm:p-8">
            <span className={cn("badge", h.tone)} data-testid="stage-badge">
              {h.badge}
            </span>
            <h2 className="h3 mt-4">{h.title}</h2>
            <p className="mt-3 leading-relaxed text-muted">{h.body}</p>
          </div>

          {rejected && status.stage === "PAYMENT_PENDING" && (
            <div className="notice notice-danger">
              <p className="font-semibold">Your last payment submission was rejected.</p>
              <p className="mt-1">Reason: {status.payment?.rejectionReason}</p>
              {!status.canPay && <p className="mt-1">Resubmission is closed. Please contact the organisers.</p>}
            </div>
          )}

          {status.canPay && (
            <div className="card p-6 sm:p-8">
              <h2 className="h3">Pay the team fee</h2>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted">
                <li>
                  Open bKash or Nagad and choose <strong className="text-fg">Send Money</strong>.
                </li>
                <li>
                  Send exactly <strong className="text-fg">BDT {status.settings.feeBdt.toLocaleString("en-US")}</strong> to one of the numbers below. This is for the whole team.
                </li>
                <li>Enter the transaction ID here before {formatDhaka(status.settings.phase2CloseAt)}.</li>
              </ol>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  ["bKash (Send Money)", status.settings.bkashNumber],
                  ["Nagad (Send Money)", status.settings.nagadNumber],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-line bg-surface-2/60 p-4">
                    <dt className="text-xs uppercase tracking-wider text-muted">{k}</dt>
                    <dd className="mt-1 font-mono text-lg font-semibold">{v || "To be announced"}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-7 border-t border-line pt-7">
                <PaymentForm registrationId={status.registrationId} teamName={status.teamName} feeBdt={status.settings.feeBdt} screenshotRequired={status.settings.screenshotRequired} />
              </div>
            </div>
          )}

          {status.payment && status.stage !== "PAYMENT_PENDING" && (
            <div className="card p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Payment submitted</h2>
              <p className="mt-2 font-mono text-sm">
                {status.payment.provider === "BKASH" ? "bKash" : "Nagad"} · {status.payment.transactionId} · {formatDhaka(status.payment.submittedAt)}
              </p>
            </div>
          )}

          {qr && (
            <div className="card flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:text-left">
              <div className="h-40 w-40 shrink-0 overflow-hidden rounded-xl bg-white p-2" role="img" aria-label={`Check-in code for ${status.registrationId}`} dangerouslySetInnerHTML={{ __html: qr }} />
              <div>
                <h2 className="h3">Team pass</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">Show this at the check-in desk on hackathon day. {status.checkedIn > 0 ? `${status.checkedIn} of ${status.teamSize} member(s) checked in.` : ""}</p>
                <p className="mt-3 font-mono text-lg font-semibold">{status.registrationId}</p>
              </div>
            </div>
          )}

          <p className="text-sm text-muted">
            This page shows your team only and signs you out after 30 minutes. <Link href="/contact" className="text-primary-soft underline underline-offset-4">Contact the organisers</Link> if something looks wrong.
          </p>
        </section>
      </div>
    </>
  );
}
