import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { AuraBackground } from "@/components/ui/aura";
import { SmoothScroll } from "@/components/ui/motion";
import { getCtx } from "@/lib/ctx";
import { getSettings } from "@/lib/settings";

// Public pages read live settings (phase windows, schedule, results), so they render per request.
export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings(getCtx());
  return (
    <>
      <SmoothScroll />
      <Header />
      <main id="main" className="relative">
        <AuraBackground />
        <div aria-hidden className="bg-noise pointer-events-none fixed inset-0 z-0" />
        <div className="relative z-10">{children}</div>
      </main>
      <Footer contactEmail={settings.contactEmail} contactPhone={settings.contactPhone} />
    </>
  );
}
