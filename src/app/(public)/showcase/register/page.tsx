import type { Metadata } from "next";
import Link from "next/link";
import { ShowcaseForm } from "@/components/forms/showcase-form";
import { PageHeader } from "@/components/ui/page-header";
import { SHOWCASE } from "@/config/showcase";
import { showcaseWindow } from "@/features/showcase/service";
import { getCtx } from "@/lib/ctx";

export const metadata: Metadata = {
  title: "Register: Project Showcase",
  description: "Register for the CoU Technova 2026 Project Showcase Competition. Comilla University students only. BDT 50 per participant.",
  alternates: { canonical: "/showcase/register" },
};

export default async function ShowcaseRegisterPage() {
  const ctx = getCtx();
  const state = showcaseWindow(ctx.now());
  return (
    <>
      <PageHeader
        eyebrow="Project Showcase · Registration"
        title="Register your project"
        lead={`For Comilla University students only. Teams of 1 to ${SHOWCASE.maxTeam}, BDT ${SHOWCASE.feeBdt} per participant, paid by bKash. Registration is open ${SHOWCASE.registrationOpens.replace(" 2026", "")} – ${SHOWCASE.registrationCloses}.`}
      />
      <div className="container-page py-12 md:py-16">
        {state === "open" ? (
          <ShowcaseForm turnstileSiteKey={ctx.env.TURNSTILE_SITE_KEY} />
        ) : (
          <div className="card mx-auto max-w-2xl p-8 text-center sm:p-12">
            <h2 className="h2">{state === "before" ? "Registration opens soon" : "Registration has closed"}</h2>
            <p className="mt-4 text-muted">
              {state === "before" ? `Showcase registration opens on ${SHOWCASE.registrationOpens}.` : `Showcase registration closed on ${SHOWCASE.registrationCloses}.`} Questions? Contact the organisers on the showcase page.
            </p>
            <Link href="/showcase" className="btn btn-primary mt-8">
              Back to the showcase
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
