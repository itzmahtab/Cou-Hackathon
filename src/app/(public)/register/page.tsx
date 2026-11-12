import type { Metadata } from "next";
import Link from "next/link";
import { RegisterWizard } from "@/components/forms/register-wizard";
import { PageHeader } from "@/components/ui/page-header";
import { getPublicEvent } from "@/features/event/queries";
import { getCtx } from "@/lib/ctx";
import { formatDhaka } from "@/lib/time";

export const metadata: Metadata = { title: "Register", description: "Register your team and submit your idea for CoU AI Hackathon 2026. Phase 1 is free.", alternates: { canonical: "/register" } };

export default async function RegisterPage() {
  const ctx = getCtx();
  const { settings, phases } = await getPublicEvent(ctx);
  return (
    <>
      <PageHeader
        eyebrow="Phase 1 · Pre-registration"
        title="Register your team"
        lead={`Free. Takes about ten minutes. Open until ${formatDhaka(settings.phase1CloseAt)} (Bangladesh time). Have each member's student ID card photo and your idea document ready.`}
      />
      <div className="container-page py-12 md:py-16">
        {phases.phase1 === "open" ? (
          <RegisterWizard turnstileSiteKey={ctx.env.TURNSTILE_SITE_KEY} announcement={settings.shortlistAnnouncement} />
        ) : (
          <div className="card mx-auto max-w-2xl p-8 text-center sm:p-12">
            <h2 className="h2">{phases.phase1 === "before" ? "Registration opens soon" : "Phase 1 registration has closed"}</h2>
            <p className="mt-4 text-muted">
              {phases.phase1 === "before"
                ? `Phase 1 opens on ${formatDhaka(settings.phase1OpenAt)} (Bangladesh time). Use the time to form your team and write up your idea.`
                : `Registration closed on ${formatDhaka(settings.phase1CloseAt)}. Selection results are emailed on ${settings.shortlistAnnouncement}.`}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href={phases.phase1 === "before" ? "/rules" : "/status"} className="btn btn-primary">
                {phases.phase1 === "before" ? "Read the rules" : "Check your status"}
              </Link>
              <Link href="/" className="btn btn-secondary">
                Back to home
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
