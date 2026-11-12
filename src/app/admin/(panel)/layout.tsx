import { AdminNav } from "@/components/admin/nav";
import { can, PERMISSIONS, ROLE_LABELS } from "@/lib/auth/permissions";
import { requireAdminPage } from "@/lib/server";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requireAdminPage();
  const allowed = PERMISSIONS.filter((p) => can(admin.role, p));
  return (
    <>
      <AdminNav allowed={[...allowed]} name={admin.name} role={ROLE_LABELS[admin.role]} />
      <main id="main" className="px-4 py-8 sm:px-8 lg:ml-64 lg:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </>
  );
}
