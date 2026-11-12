import Link from "next/link";
import { AdminHeader, Empty, StatusBadge } from "@/components/admin/ui";
import { reviewQueue } from "@/features/reviews/queries";
import { requireAdminPage } from "@/lib/server";

export const metadata = { title: "Idea review" };

export default async function Reviews({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, admin } = await requireAdminPage("reviews.read");
  const sp = await searchParams;
  const rows = await reviewQueue(ctx, admin.id, sp);
  const todo = rows.filter((r) => r.mine === null).length;
  return (
    <>
      <AdminHeader title="Idea review" lead={`Score each idea out of 100. ${todo} idea(s) in this view still need your review. Tick up to three to compare side by side.`} />
      <form className="card mb-5 flex flex-wrap gap-3 p-4" role="search">
        <select name="mine" defaultValue={sp.mine ?? ""} className="input w-auto" aria-label="My reviews">
          <option value="">All ideas</option>
          <option value="todo">Not reviewed by me</option>
          <option value="done">Reviewed by me</option>
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="input w-auto" aria-label="Status">
          <option value="">Any status</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="UNDER_REVIEW">Under review</option>
          <option value="SHORTLISTED">Shortlisted</option>
          <option value="NOT_SELECTED">Not selected</option>
        </select>
        <select name="sort" defaultValue={sp.sort ?? ""} className="input w-auto" aria-label="Sort">
          <option value="">Highest score</option>
          <option value="reviews">Fewest reviews</option>
          <option value="oldest">Oldest first</option>
        </select>
        <button className="btn btn-primary">Apply</button>
      </form>
      {rows.length === 0 ? (
        <Empty>No ideas match.</Empty>
      ) : (
        <form action="/admin/reviews/compare">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Compare</span>
                  </th>
                  <th scope="col">Idea</th>
                  <th scope="col">Team</th>
                  <th scope="col">Average</th>
                  <th scope="col">Reviews</th>
                  <th scope="col">Mine</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <input type="checkbox" name="ids" value={r.id} aria-label={`Compare ${r.title}`} className="h-4 w-4 accent-[#8b5cf6]" />
                    </td>
                    <td>
                      <Link href={`/admin/reviews/${r.id}`} className="font-semibold hover:text-primary-soft">
                        {r.title}
                      </Link>
                    </td>
                    <td className="text-muted">
                      {r.name} <span className="block font-mono text-xs">{r.registrationId}</span>
                    </td>
                    <td className="font-mono">{r.score ?? "—"}</td>
                    <td className="font-mono">{r.count}</td>
                    <td className="font-mono">{r.mine ?? <span className="badge badge-warning">To do</span>}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-secondary btn-sm mt-4">Compare selected</button>
        </form>
      )}
    </>
  );
}
