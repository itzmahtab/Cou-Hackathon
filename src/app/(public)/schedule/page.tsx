import { Megaphone } from "lucide-react";
import type { Metadata } from "next";
import { ScheduleList, Timeline } from "@/components/sections/home";
import { PageHeader } from "@/components/ui/page-header";
import { getAnnouncements, getPublicEvent, getSchedule } from "@/features/event/queries";
import { getCtx } from "@/lib/ctx";
import { formatDhaka } from "@/lib/time";

export const metadata: Metadata = { title: "Event schedule", description: "Key dates and the hackathon-day running order for CoU AI Hackathon 2026.", alternates: { canonical: "/schedule" } };

export default async function SchedulePage() {
  const ctx = getCtx();
  const [{ settings, phases }, items, news] = await Promise.all([getPublicEvent(ctx), getSchedule(ctx), getAnnouncements(ctx, 10)]);
  return (
    <>
      <PageHeader eyebrow="Schedule" title="How the day runs" lead={`${formatDhaka(settings.eventStartAt, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${settings.venue}. Times are Bangladesh Standard Time and may be updated by the organisers.`} />
      <div className="container-page py-14 md:py-20">
        {news.length > 0 && (
          <section aria-label="Announcements" className="mb-12 grid gap-3">
            {news.map((n) => (
              <div key={n.id} className="notice notice-info flex gap-3">
                <Megaphone size={18} className="mt-0.5 shrink-0 text-secondary" aria-hidden />
                <div>
                  <p className="font-semibold">{n.title}</p>
                  <p className="mt-1 whitespace-pre-line text-muted">{n.body}</p>
                </div>
              </div>
            ))}
          </section>
        )}
        <ScheduleList items={items} />
      </div>
      <Timeline settings={settings} phases={phases} />
    </>
  );
}
