import { Download, ExternalLink, Eye, Mail } from "lucide-react";
import Link from "next/link";
import { CopyButton } from "@/components/admin/copy-button";
import { CopyRichButton } from "@/components/admin/copy-rich-button";
import { AdminHeader, Empty, Section, Stat, StatusBadge } from "@/components/admin/ui";
import { WaitlistSelectButton } from "@/components/admin/waitlist-select-button";
import { ActionForm } from "@/components/admin/action-form";
import { removeFromFinalSelectionAction } from "@/app/admin/actions/selection";
import { can } from "@/lib/auth/permissions";
import { renderForTeam, selectionContext, type SelectionTeam } from "@/features/selection/service";
import { gmailComposeLink, mailtoLink } from "@/features/selection/template";
import { requireAdminPage } from "@/lib/server";

export const metadata = { title: "Final selection" };

type Composed = { subject: string; text: string; fragment: string; to: string[]; mailto: string; gmail: string };

/** Shows +8801XXXXXXXXX as 01XXX-XXXXXX, which people read and dial more easily. */
const localPhone = (p: string) => (p.startsWith("+880") ? `0${p.slice(4, 8)}-${p.slice(8)}` : p);

export default async function FinalSelection() {
  const { ctx, admin } = await requireAdminPage("registrations.contact");
  const canRemove = can(admin.role, "shortlist.manage");
  const { selected, waiting, rejected, others, settings, tpl, assetBase } = await selectionContext(ctx);

  const compose = (team: SelectionTeam): Composed => {
    const mail = renderForTeam(team, settings, tpl, assetBase);
    const to = team.members.map((m) => m.email);
    // Gmail opens with recipients and subject; the formatted body is pasted in from "Copy formatted email".
    return { subject: mail.subject, text: mail.text, fragment: mail.fragment, to, mailto: mailtoLink(to, mail.subject, mail.text), gmail: gmailComposeLink(to, mail.subject) };
  };
  const emailsOf = (list: SelectionTeam[]) => list.flatMap((t) => t.members.map((m) => m.email)).join(", ");
  const phonesOf = (list: SelectionTeam[]) => list.flatMap((t) => t.members.map((m) => `${m.fullName} (${t.name}): ${localPhone(m.phone)}`)).join("\n");

  return (
    <>
      <AdminHeader
        title="Final selection"
        lead="Selected teams, the waiting queue and rejected teams, with every member's contacts. Nothing on this page sends email."
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
        <ol className="mb-4 grid list-decimal gap-1 pl-5 text-sm text-muted">
          <li>
            Click <strong>Gmail</strong>: a compose window opens with every member as a recipient and the subject filled in.
          </li>
          <li>
            Click <strong>Copy formatted email</strong>, then paste (Ctrl+V) into the message box: the banner, buttons and links come with it.
          </li>
          <li>Check it and press Send. Use <strong>Preview</strong> to see the email first. Nothing on this page sends email; to email all selected teams at once, use the Send button on the Emails page.</li>
        </ol>
        <TeamList teams={selected} compose={compose} withEmail remove={canRemove} />
      </Section>

      <Section title={`Waiting (${waiting.length})`} className="mb-6" actions={<CopyButton text={emailsOf(waiting)} label="Copy all emails" />}>
        <p className="mb-4 text-sm text-muted">
          Next in line, in this order. <strong>Select &amp; send selection email</strong> moves a team to the selected list and emails its members the selection email (super admin). Manage the queue order on the Shortlist page.
        </p>
        <TeamList teams={waiting} compose={compose} queue promote={can(admin.role, "emails.broadcast")} remove={canRemove} />
      </Section>

      <Section title={`Rejected (${rejected.length})`} actions={rejected.length > 0 ? <CopyButton text={emailsOf(rejected)} label="Copy all emails" /> : undefined}>
        <TeamList teams={rejected} compose={compose} />
      </Section>
    </>
  );
}

function TeamList({ teams, compose, withEmail = false, queue = false, promote = false, remove = false }: { teams: SelectionTeam[]; compose: (t: SelectionTeam) => Composed; withEmail?: boolean; queue?: boolean; promote?: boolean; remove?: boolean }) {
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
                        <a className="btn btn-secondary btn-sm" href={c.gmail} target="_blank" rel="noreferrer">
                          <ExternalLink size={14} aria-hidden /> Gmail
                        </a>
                        <CopyRichButton html={c.fragment} text={c.text} primary />
                        <a className="btn btn-secondary btn-sm" href={`/admin/final-selection/preview/${t.id}`} target="_blank" rel="noreferrer">
                          <Eye size={14} aria-hidden /> Preview
                        </a>
                        <a className="btn btn-secondary btn-sm" href={c.mailto} title="Opens your mail app with a plain-text version">
                          <Mail size={14} aria-hidden /> Plain text
                        </a>
                      </>
                    )}
                    {promote && <WaitlistSelectButton teamId={t.id} teamName={t.name} members={t.members.length} />}
                    <CopyButton text={c.to.join(", ")} label="Copy emails" />
                    {remove && (
                      <ActionForm action={removeFromFinalSelectionAction} submitLabel="Remove" submitClass="btn-danger" inline confirm={`Remove ${t.name} from the final selection? It will be listed under Rejected. No email is sent.`}>
                        <input type="hidden" name="teamId" value={t.id} />
                      </ActionForm>
                    )}
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
