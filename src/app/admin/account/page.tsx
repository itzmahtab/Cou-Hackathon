import Link from "next/link";
import { redirect } from "next/navigation";
import { changePasswordAction } from "../actions/auth";
import { ActionForm } from "@/components/admin/action-form";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { currentAdmin } from "@/lib/server";

export const metadata = { title: "Account" };

// Outside the panel layout so a forced password change cannot redirect-loop.
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ first?: string }> }) {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  const { first } = await searchParams;
  return (
    <main id="main" className="mx-auto max-w-md px-5 py-16">
      {!admin.mustChangePassword && (
        <Link href="/admin" className="text-sm text-muted hover:text-fg">
          ← Dashboard
        </Link>
      )}
      <h1 className="mt-4 text-2xl font-semibold">Your account</h1>
      <p className="mt-1 text-sm text-muted">
        {admin.name} · {admin.email} · {ROLE_LABELS[admin.role]}
      </p>
      {(first || admin.mustChangePassword) && <p className="notice notice-warning mt-6">Set a new password before you continue.</p>}
      <div className="card mt-6 p-6">
        <h2 className="font-semibold">Change password</h2>
        <ActionForm action={changePasswordAction} submitLabel="Change password" className="mt-4" resetOnSuccess>
          {(
            [
              ["current", "Current password", "current-password"],
              ["next", "New password (at least 12 characters)", "new-password"],
              ["repeat", "Repeat new password", "new-password"],
            ] as const
          ).map(([name, label, ac]) => (
            <label key={name} className="text-sm">
              <span className="field-label">{label}</span>
              <input name={name} type="password" autoComplete={ac} className="input" required />
            </label>
          ))}
        </ActionForm>
      </div>
      {admin.mustChangePassword ? null : (
        <Link href="/admin" className="btn btn-secondary mt-6">
          Continue to dashboard
        </Link>
      )}
    </main>
  );
}
