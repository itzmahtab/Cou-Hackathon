import { Download, ExternalLink, Mail } from "lucide-react";
import Link from "next/link";
import { CopyButton } from "@/components/admin/copy-button";
import { AdminHeader, Empty, Section, Stat, StatusBadge } from "@/components/admin/ui";
import { selectionContext, templateVars, type SelectionTeam } from "@/features/selection/service";
import { fillTemplate, gmailComposeLink, mailtoLink } from "@/features/selection/template";
import { requireAdminPage } from "@/lib/server";

export const metadata = { title: "Final selection" };

type Composed = { subject: string; body: string; to: string[]; mailto: string; gmail: string };

/** Shows +8801XXXXXXXXX as 01XXX-XXXXXX, which people read and dial more easily. */
const localPhone = (p: string) => (p.startsWith("+880") ? `0${p.slice(4, 8)}-${p.slice(8)}` : p);

export default async function FinalSelection() {
  const { ctx } = await requireAdminPage("registrations.contact");
  const { selected, waiting, rejected, others, settings, tpl } = await selectionContext(ctx);

  const compose = (team: SelectionTeam): Composed => {
    const vars = templateVars(team, settings, tpl);
    const subject = fillTemplate(tpl.subject, vars);
    const body = fillTemplate(tpl.body, vars);
    const to = team.members.map((m) => m.email);
    return { subject, body, to, mailto: mailtoLink(to, subject, body), gmail: gmailComposeLink(to, subject, body) };
  };
  const emailsOf = (list: SelectionTeam[]) => list.flatMap((t) => t.members.map((m) => m.email)).join(", ");
  const phonesOf = (list: SelectionTeam[]) => list.flatMap((t) => t.members.map((m) => `${m.fullName} (${t.name}): ${localPhone(m.phone)}`)).join("\n");

  return (
    <>
      <AdminHeader
        title="Final selection"
        lead="Selected teams, the waiting queue and rejected teams, with every member's contacts. Emails are sent by hand: nothing on this page sends anything from the portal."
        actions={
          <a className="btn btn-secondary btn-sm" href="/api/v1/admin/export/final-selection">
            <Download size={15} aria-hidden /> Export contacts CSV
          </a>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Selected" value={selected.length} hint={`${selected.reduce((n, t) => n + t.members.length, 0)} participants`} />
        <Stat label="Waiting" value={waiting.length} hint="In queue order" />
        <Stat label="Rejected" value={rejected.length} hint="In the final review" />
        <Stat label="Other teams" value={others} hint="Not selected" />
      </div>

      <Section
        title={`Selected teams (${selected.length})`}
        className="mb-6"
        actions={
          <div className="flex flex-wrap gap-2">
            <CopyButton text={emailsOf(selected)} label="Copy all emails (BCC)" />
            <CopyButton text={phonesOf(selected)} label="Copy all phones" />
            <Link href="/admin/emails" className="btn btn-secondary btn-sm">
              Edit email template
            </Link>
          </div>
        }
      >
        <p className="mb-4 text-sm text-muted">
          <strong>Send email</strong> opens your own mail app with every member as a recipient and the template filled in for that team; you press Send there. <strong>Gmail</strong> does the same in a Gmail browser tab.
        </p>
        <TeamList teams={selected} compose={compose} withEmail />
      </Section>

      <Section title={`Waiting (${waiting.length})`} className="mb-6" actions={<CopyButton text={emailsOf(waiting)} label="Copy all emails" />}>
        <p className="mb-4 text-sm text-muted">Next in line, in this order, if a selected team does not confirm. Manage the queue on the Shortlist page.</p>
        <TeamList teams={waiting} compose={compose} queue />
      </Section>

      <Section title={`Rejected (${rejected.length})`} actions={rejected.length > 0 ? <CopyButton text={emailsOf(rejected)} label="Copy all emails" /> : undefined}>
        <TeamList teams={rejected} compose={compose} />
      </Section>
    </>
  );
}

function TeamList({ teams, compose, withEmail = false, queue = false }: { teams: SelectionTeam[]; compose: (t: SelectionTeam) => Composed; withEmail?: boolean; queue?: boolean }) {
  if (teams.length === 0) return <Empty>No teams.</Empty>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Team and idea</th>
            <th scope="col">Members</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t, i) => {
            const c = compose(t);
            return (
              <tr key={t.id}>
                <td className="font-mono text-muted">{queue ? `#${t.waitlist}` : i + 1}</td>
                <td className="min-w-56">
                  <Link href={`/admin/registrations/${t.id}`} className="font-semibold hover:text-primary-soft">
                    {t.name}
                  </Link>
                  <span className="block font-mono text-xs text-muted">
                    {t.registrationId} · score {t.score ?? "—"}
                  </span>
                  <span className="mt-1 block text-xs text-muted">{t.title}</span>
                  <span className="mt-1 inline-block">
                    <StatusBadge status={t.status} />
                  </span>
                </td>
                <td className="min-w-72">
                  <ul className="grid gap-2 text-sm">
                    {t.members.map((m) => (
                      <li key={m.email}>
                        <span className="font-medium">{m.fullName}</span>
                        {m.position === 1 && <span className="ml-1.5 text-xs text-muted">(leader)</span>}
                        <span className="block text-xs text-muted">{m.university}</span>
                        <a href={`mailto:${m.email}`} className="block text-xs hover:text-primary-soft">
                          {m.email}
                        </a>
                        <span className="block font-mono text-xs">
                          <a href={`tel:${m.phone}`} className="whitespace-nowrap hover:text-primary-soft">
                            {localPhone(m.phone)}
                          </a>
                          {m.whatsapp && m.whatsapp !== m.phone && (
                            <>
                              {" · WhatsApp "}
                              <a href={`https://wa.me/${m.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="whitespace-nowrap hover:text-primary-soft">
                                {localPhone(m.whatsapp)}
                              </a>
                            </>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="min-w-52">
                  <div className="flex flex-wrap gap-2">
                    {withEmail && (
                      <>
                        <a className="btn btn-primary btn-sm" href={c.mailto}>
                          <Mail size={14} aria-hidden /> Send email
                        </a>
                        <a className="btn btn-secondary btn-sm" href={c.gmail} target="_blank" rel="noreferrer">
                          <ExternalLink size={14} aria-hidden /> Gmail
                        </a>
                        <CopyButton text={c.body} label="Copy message" />
                      </>
                    )}
                    <CopyButton text={c.to.join(", ")} label="Copy emails" />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
