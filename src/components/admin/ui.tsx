import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const TEAM_TONE: Record<string, [string, string]> = {
  SUBMITTED: ["badge-info", "Submitted"],
  UNDER_REVIEW: ["badge-primary", "Under review"],
  SHORTLISTED: ["badge-warning", "Shortlisted"],
  NOT_SELECTED: ["badge-neutral", "Not selected"],
  CONFIRMED: ["badge-success", "Confirmed"],
  DISQUALIFIED: ["badge-danger", "Disqualified"],
  PENDING_VERIFICATION: ["badge-warning", "Pending"],
  VERIFIED: ["badge-success", "Verified"],
  REJECTED: ["badge-danger", "Rejected"],
  QUEUED: ["badge-info", "Queued"],
  SENT: ["badge-success", "Sent"],
  FAILED: ["badge-warning", "Failed"],
  DEAD: ["badge-danger", "Gave up"],
};

export function StatusBadge({ status }: { status: string }) {
  const [tone, label] = TEAM_TONE[status] ?? ["badge-neutral", status];
  return <span className={cn("badge", tone)}>{label}</span>;
}

export function AdminHeader({ title, lead, actions }: { title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {lead && <p className="mt-1.5 max-w-3xl text-sm text-muted">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card p-5">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card p-10 text-center text-sm text-muted">{children}</div>;
}

export function Pagination({ page, total, pageSize, params }: { page: number; total: number; pageSize: number; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <p className="mt-4 text-sm text-muted">{total} result{total === 1 ? "" : "s"}</p>;
  const href = (p: number) => `?${new URLSearchParams(Object.entries({ ...params, page: String(p) }).filter((e): e is [string, string] => !!e[1])).toString()}`;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm text-muted">
      <span>
        {total} results · page {page} of {pages}
      </span>
      <span className="flex gap-2">
        {page > 1 && (
          <Link className="btn btn-secondary btn-sm" href={href(page - 1)}>
            Previous
          </Link>
        )}
        {page < pages && (
          <Link className="btn btn-secondary btn-sm" href={href(page + 1)}>
            Next
          </Link>
        )}
      </span>
    </nav>
  );
}

export function Section({ title, children, actions, className }: { title: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={cn("card p-5 sm:p-6", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
