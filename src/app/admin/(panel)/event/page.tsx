import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { attendanceAction } from "@/app/admin/actions/payments";
import { createAnnouncementAction, deleteScheduleItemAction, saveScheduleItemAction, seedScheduleAction, toggleAnnouncementAction } from "@/app/admin/actions/event";
import { ActionForm } from "@/components/admin/action-form";
import { AdminHeader, Empty, Section } from "@/components/admin/ui";
import { can } from "@/lib/auth/permissions";
import { announcements, attendance, eventSchedules, participants, teams } from "@/lib/db/schema";
import { requireAdminPage } from "@/lib/server";
import { formatDhaka } from "@/lib/time";

export const metadata = { title: "Event day" };

export default async function EventDay({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { ctx, admin } = await requireAdminPage("event.manage");
  const { q } = await searchParams;
  const pattern = q?.trim() ? `%${q.trim().replace(/[%_]/g, "")}%` : null;
  const [confirmed, present, schedule, news] = await Promise.all([
    ctx.db
      .select({ team: teams, p: participants })
      .from(teams)
      .innerJoin(participants, eq(participants.teamId, teams.id))
      .where(and(eq(teams.status, "CONFIRMED"), pattern ? or(like(teams.name, pattern), like(teams.registrationId, pattern.toUpperCase()), sql`exists (select 1 from participants x where x.team_id = ${teams.id} and x.full_name like ${pattern})`) : undefined))
      .orderBy(asc(teams.nameNorm), asc(participants.position)),
    ctx.db.select({ participantId: attendance.participantId, at: attendance.checkedInAt }).from(attendance),
    ctx.db.select().from(eventSchedules).orderBy(asc(eventSchedules.sortOrder)),
    ctx.db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(20),
  ]);
  const checked = new Map(present.map((a) => [a.participantId, a.at]));
  const byTeam = new Map<string, { team: (typeof confirmed)[number]["team"]; members: (typeof confirmed)[number]["p"][] }>();
  for (const row of confirmed) {
    const entry = byTeam.get(row.team.id) ?? { team: row.team, members: [] };
    entry.members.push(row.p);
    byTeam.set(row.team.id, entry);
  }
  const total = [...byTeam.values()].reduce((a, t) => a + t.members.length, 0);
  const totalPresent = [...byTeam.values()].reduce((a, t) => a + t.members.filter((m) => checked.has(m.id)).length, 0);

  return (
    <>
      <AdminHeader title="Event day" lead={`Check-in, schedule and announcements. ${totalPresent} of ${total} confirmed participants checked in.`} />
      <Section title="Check-in" className="mb-6">
        <form className="mb-4 flex gap-3" role="search">
          <input name="q" defaultValue={q} placeholder="Team name, registration ID or participant (scanning a team pass fills this in)" aria-label="Find team" className="input flex-1" autoFocus />
          <button className="btn btn-primary">Find</button>
        </form>
        {byTeam.size === 0 ? (
          <Empty>{q ? "No confirmed team matches." : "No confirmed teams yet."}</Empty>
        ) : (
          <ul className="grid gap-3">
            {[...byTeam.values()].map(({ team, members }) => {
              const n = members.filter((m) => checked.has(m.id)).length;
              return (
                <li key={team.id} className="rounded-xl border border-line p-4">
                  <p className="font-semibold">
                    {team.name} <span className="font-mono text-xs text-muted">{team.registrationId}</span>{" "}
                    <span className={`badge ml-1 ${n === members.length ? "badge-success" : n > 0 ? "badge-warning" : "badge-neutral"}`}>
                      {n}/{members.length} present
                    </span>
                  </p>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                    {members.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
                        <span>
                          {m.fullName} <span className="text-xs text-muted">· {m.tshirtSize}</span>
                        </span>
                        <ActionForm action={attendanceAction} submitLabel={checked.has(m.id) ? "Undo" : "Check in"} submitClass={checked.has(m.id) ? "btn-ghost" : "btn-primary"} inline>
                          <input type="hidden" name="participantId" value={m.id} />
                          <input type="hidden" name="present" value={checked.has(m.id) ? "0" : "1"} />
                        </ActionForm>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Schedule" actions={schedule.length === 0 && <ActionForm action={seedScheduleAction} submitLabel="Add suggested schedule" submitClass="btn-secondary" />}>
          {schedule.length === 0 && <p className="mb-4 text-sm text-muted">The public site shows the suggested running order with times “to be announced” until you add items.</p>}
          <ul className="grid gap-3">
            {schedule.map((s) => (
              <li key={s.id} className="rounded-xl border border-line p-3">
                <ActionForm action={saveScheduleItemAction} submitLabel="Save" submitClass="btn-secondary">
                  <input type="hidden" name="id" value={s.id} />
                  <div className="grid grid-cols-[5rem_1fr] gap-2">
                    <input name="sortOrder" type="number" defaultValue={s.sortOrder} aria-label="Order" className="input font-mono" />
                    <input name="timeLabel" defaultValue={s.timeLabel} aria-label="Time" placeholder="9:00 am" className="input" />
                  </div>
                  <input name="title" defaultValue={s.title} aria-label="Title" className="input" />
                  <input name="description" defaultValue={s.description ?? ""} aria-label="Description" className="input" />
                </ActionForm>
                <ActionForm action={deleteScheduleItemAction} submitLabel="Delete" submitClass="btn-ghost" confirm={`Delete “${s.title}”?`} className="mt-2">
                  <input type="hidden" name="id" value={s.id} />
                </ActionForm>
              </li>
            ))}
          </ul>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-primary-soft">Add an item</summary>
            <ActionForm action={saveScheduleItemAction} submitLabel="Add" className="mt-3" resetOnSuccess>
              <div className="grid grid-cols-[5rem_1fr] gap-2">
                <input name="sortOrder" type="number" defaultValue={(schedule.at(-1)?.sortOrder ?? 0) + 10} aria-label="Order" className="input font-mono" />
                <input name="timeLabel" placeholder="Time, e.g. 2:30 pm" aria-label="Time" className="input" required />
              </div>
              <input name="title" placeholder="Title" aria-label="Title" className="input" required />
              <input name="description" placeholder="Description (optional)" aria-label="Description" className="input" />
            </ActionForm>
          </details>
        </Section>

        <Section title="Announcements">
          <ActionForm action={createAnnouncementAction} submitLabel="Post announcement" resetOnSuccess>
            <input name="title" placeholder="Title" aria-label="Title" className="input" required maxLength={120} />
            <textarea name="body" placeholder="Message" aria-label="Message" className="input min-h-28" required maxLength={2000} />
            <div className="grid gap-2 sm:grid-cols-2">
              <select name="publish" defaultValue="1" aria-label="Visibility" className="input">
                <option value="1">Show on website</option>
                <option value="0">Do not show on website</option>
              </select>
              <select name="audience" defaultValue="none" aria-label="Email" className="input" disabled={!can(admin.role, "emails.broadcast")}>
                <option value="none">Do not email</option>
                <option value="confirmed">Email confirmed teams</option>
                <option value="shortlisted">Email shortlisted and confirmed</option>
                <option value="all">Email every participant</option>
              </select>
            </div>
          </ActionForm>
          <ul className="mt-5 grid gap-2">
            {news.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-3 rounded-xl border border-line p-3 text-sm">
                <div>
                  <p className="font-medium">{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-muted">{n.body}</p>
                  <p className="mt-1 text-xs text-muted">{n.isPublished ? `Live since ${formatDhaka(n.publishedAt)}` : "Hidden"}</p>
                </div>
                <ActionForm action={toggleAnnouncementAction} submitLabel={n.isPublished ? "Hide" : "Publish"} submitClass="btn-ghost" inline>
                  <input type="hidden" name="id" value={n.id} />
                  <input type="hidden" name="publish" value={n.isPublished ? "0" : "1"} />
                </ActionForm>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  );
}
