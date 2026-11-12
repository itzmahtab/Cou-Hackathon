import { asc, eq, sql } from "drizzle-orm";
import { Download } from "lucide-react";
import Link from "next/link";
import { AdminHeader, Empty, Section } from "@/components/admin/ui";
import { can } from "@/lib/auth/permissions";
import { TSHIRT_SIZES } from "@/lib/constants";
import { participants, teams } from "@/lib/db/schema";
import { requireAdminPage } from "@/lib/server";

export const metadata = { title: "Approved participants" };

export default async function Approved() {
  const { ctx, admin } = await requireAdminPage("registrations.read");
  const contact = can(admin.role, "registrations.contact");
  const rows = await ctx.db
    .select({ team: teams.name, teamId: teams.id, registrationId: teams.registrationId, p: participants, present: sql<number>`exists (select 1 from attendance a where a.participant_id = ${participants.id})` })
    .from(participants)
    .innerJoin(teams, eq(teams.id, participants.teamId))
    .where(eq(teams.status, "CONFIRMED"))
    .orderBy(asc(teams.nameNorm), asc(participants.position));
  const sizes = Object.fromEntries(TSHIRT_SIZES.map((s) => [s, rows.filter((r) => r.p.tshirtSize === s).length]));
  const teamCount = new Set(rows.map((r) => r.teamId)).size;

  return (
    <>
      <AdminHeader
        title="Approved participants"
        lead={`${rows.length} participants in ${teamCount} confirmed teams.`}
        actions={
          can(admin.role, "registrations.export") && (
            <a className="btn btn-secondary btn-sm" href="/api/v1/admin/export/registrations?status=CONFIRMED">
              <Download size={15} aria-hidden /> Export CSV
            </a>
          )
        }
      />
      <Section title="T-shirt sizes" className="mb-6">
        <dl className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {TSHIRT_SIZES.map((s) => (
            <div key={s} className="rounded-xl border border-line p-3 text-center">
              <dt className="text-xs text-muted">{s}</dt>
              <dd className="mt-1 font-mono text-xl">{sizes[s]}</dd>
            </div>
          ))}
        </dl>
      </Section>
      {rows.length === 0 ? (
        <Empty>No confirmed teams yet. Teams appear here once their payment is verified.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Participant</th>
                <th scope="col">Team</th>
                <th scope="col">University</th>
                {contact && <th scope="col">Contact</th>}
                <th scope="col">T-shirt</th>
                <th scope="col">Checked in</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.p.id}>
                  <td className="font-medium">{r.p.fullName}</td>
                  <td>
                    <Link href={`/admin/registrations/${r.teamId}`} className="hover:text-primary-soft">
                      {r.team}
                    </Link>
                  </td>
                  <td className="text-muted">{r.p.university}</td>
                  {contact && (
                    <td className="text-muted">
                      {r.p.phone}
                      <span className="block text-xs">{r.p.email}</span>
                    </td>
                  )}
                  <td className="font-mono">{r.p.tshirtSize}</td>
                  <td>{r.present ? <span className="badge badge-success">Yes</span> : <span className="badge badge-neutral">No</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
