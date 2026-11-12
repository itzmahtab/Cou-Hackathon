import { and, desc, eq, like, type SQL } from "drizzle-orm";
import { AdminHeader, Empty, Pagination } from "@/components/admin/ui";
import { adminActivityLogs, admins } from "@/lib/db/schema";
import { requireAdminPage } from "@/lib/server";
import { formatDhaka } from "@/lib/time";

export const metadata = { title: "Activity log" };
const SIZE = 50;

export default async function Logs({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx } = await requireAdminPage("logs.read");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: SQL[] = [];
  if (sp.action) where.push(like(adminActivityLogs.action, `${sp.action.replace(/[%_]/g, "")}%`));
  if (sp.admin) where.push(eq(adminActivityLogs.adminId, sp.admin));
  const [rows, people] = await Promise.all([
    ctx.db
      .select({ l: adminActivityLogs, who: admins.name })
      .from(adminActivityLogs)
      .leftJoin(admins, eq(admins.id, adminActivityLogs.adminId))
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(adminActivityLogs.createdAt))
      .limit(SIZE + 1)
      .offset((page - 1) * SIZE),
    ctx.db.select({ id: admins.id, name: admins.name }).from(admins),
  ]);
  const more = rows.length > SIZE;
  return (
    <>
      <AdminHeader title="Activity log" lead="Every admin sign-in, change, file view and export. Entries cannot be edited or deleted." />
      <form className="card mb-5 flex flex-wrap gap-3 p-4" role="search">
        <select name="admin" defaultValue={sp.admin ?? ""} className="input w-auto" aria-label="Admin">
          <option value="">All admins</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select name="action" defaultValue={sp.action ?? ""} className="input w-auto" aria-label="Action">
          <option value="">All actions</option>
          {["auth", "review", "shortlist", "payment", "participant", "team", "result", "file", "export", "settings", "admin", "schedule", "announcement", "retention"].map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <button className="btn btn-primary">Apply</button>
      </form>
      {rows.length === 0 ? (
        <Empty>No entries.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Admin</th>
                <th scope="col">Action</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, SIZE).map(({ l, who }) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap font-mono text-xs text-muted">{formatDhaka(l.createdAt)}</td>
                  <td>{who ?? <span className="text-muted">—</span>}</td>
                  <td className={l.action.includes("failed") ? "text-danger" : ""}>{l.action}</td>
                  <td className="max-w-md break-all font-mono text-xs text-muted">
                    {l.entityType && `${l.entityType} ${l.entityId?.slice(0, 8) ?? ""} `}
                    {l.detailJson}
                    {l.ip && ` · ${l.ip}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} total={more ? page * SIZE + 1 : (page - 1) * SIZE + rows.length} pageSize={SIZE} params={{ admin: sp.admin, action: sp.action }} />
    </>
  );
}
