import { Download } from "lucide-react";
import Link from "next/link";
import { AdminHeader, Empty, Pagination, StatusBadge } from "@/components/admin/ui";
import { listTeams, universityOptions } from "@/features/admin/queries";
import { can } from "@/lib/auth/permissions";
import { TEAM_STATUSES } from "@/lib/constants";
import { requireAdminPage } from "@/lib/server";
import { formatDhaka } from "@/lib/time";

export const metadata = { title: "Registrations" };

type SP = Promise<Record<string, string | undefined>>;

export default async function Registrations({ searchParams }: { searchParams: SP }) {
  const { ctx, admin } = await requireAdminPage("registrations.read");
  const sp = await searchParams;
  const filters = { q: sp.q, university: sp.university, size: sp.size, status: sp.status, sort: sp.sort, page: Number(sp.page) || 1 };
  const [data, unis] = await Promise.all([listTeams(ctx, filters), universityOptions(ctx)]);
  const exportQs = new URLSearchParams(Object.entries({ status: sp.status }).filter((e): e is [string, string] => !!e[1])).toString();

  return (
    <>
      <AdminHeader
        title="Registrations"
        lead="Every team, newest first. Search by team, participant name, email, student ID, idea title or registration ID."
        actions={
          can(admin.role, "registrations.export") && (
            <a className="btn btn-secondary btn-sm" href={`/api/v1/admin/export/registrations${exportQs ? `?${exportQs}` : ""}`}>
              <Download size={15} aria-hidden /> Export CSV
            </a>
          )
        }
      />
      <form className="card mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1.4fr_0.8fr_1fr_1fr_auto]" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Search…" aria-label="Search" className="input" />
        <select name="university" defaultValue={sp.university ?? ""} aria-label="University" className="input">
          <option value="">All universities</option>
          {unis.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label} ({u.n})
            </option>
          ))}
        </select>
        <select name="size" defaultValue={sp.size ?? ""} aria-label="Team size" className="input">
          <option value="">Any size</option>
          <option value="1">Solo</option>
          <option value="2">Duo</option>
          <option value="3">Trio</option>
        </select>
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className="input">
          <option value="">Any status</option>
          {TEAM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ").toLowerCase()}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={sp.sort ?? ""} aria-label="Sort" className="input">
          <option value="">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="score">Review score</option>
          <option value="name">Team name</option>
        </select>
        <button className="btn btn-primary">Apply</button>
      </form>
      {data.rows.length === 0 ? (
        <Empty>No teams match these filters.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Team</th>
                <th scope="col">Idea</th>
                <th scope="col">Universities</th>
                <th scope="col">Size</th>
                <th scope="col">Score</th>
                <th scope="col">Status</th>
                <th scope="col">Registered</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/admin/registrations/${t.id}`} className="font-semibold hover:text-primary-soft">
                      {t.name}
                    </Link>
                    <span className="block font-mono text-xs text-muted">{t.registrationId}</span>
                  </td>
                  <td className="max-w-56 text-muted">{t.ideaTitle}</td>
                  <td className="max-w-48 text-muted">{t.universities?.split(",").join(", ")}</td>
                  <td className="font-mono">{t.size}</td>
                  <td className="font-mono">{t.score ?? "—"}</td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="whitespace-nowrap text-muted">{formatDhaka(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={data.page} total={data.total} pageSize={data.pageSize} params={{ q: sp.q, university: sp.university, size: sp.size, status: sp.status, sort: sp.sort }} />
    </>
  );
}
