"use client";

import { BarChart3, CalendarCheck, ClipboardList, CreditCard, FileSearch, History, LayoutDashboard, ListChecks, LogOut, Mail, Menu, Settings, Trophy, UserCircle, Users, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/app/admin/actions/auth";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, perm: null },
  { href: "/admin/registrations", label: "Registrations", icon: Users, perm: "registrations.read" },
  { href: "/admin/reviews", label: "Idea review", icon: FileSearch, perm: "reviews.read" },
  { href: "/admin/shortlist", label: "Shortlist", icon: ListChecks, perm: "shortlist.read" },
  { href: "/admin/payments", label: "Payments", icon: CreditCard, perm: "payments.verify" },
  { href: "/admin/participants", label: "Approved participants", icon: ClipboardList, perm: "registrations.read" },
  { href: "/admin/event", label: "Event day", icon: CalendarCheck, perm: "event.manage" },
  { href: "/admin/results", label: "Results", icon: Trophy, perm: "results.manage" },
  { href: "/admin/emails", label: "Emails", icon: Mail, perm: "emails.manage" },
  { href: "/admin/logs", label: "Activity log", icon: History, perm: "logs.read" },
  { href: "/admin/settings", label: "Settings", icon: Settings, perm: "settings.manage" },
] as const;

export function AdminNav({ allowed, name, role }: { allowed: string[]; name: string; role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  const items = ADMIN_NAV.filter((i) => i.perm === null || allowed.includes(i.perm));
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur lg:hidden">
        <Image src="/event-logo-horizontal.png" alt="CoU AI Hackathon admin" width={1600} height={364} className="logo-adapt h-7 w-auto" />
        <span className="flex items-center gap-1">
          <ThemeToggle />
        <button type="button" className="btn btn-ghost btn-sm" aria-expanded={open} aria-controls="admin-nav" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((v) => !v)}>
          {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
        </button>
        </span>
      </div>
      <aside id="admin-nav" className={cn("fixed inset-y-0 left-0 z-50 w-64 flex-col border-r border-line bg-surface p-4 lg:flex", open ? "flex" : "hidden")}>
        <Link href="/admin" className="mb-6 hidden px-2 pt-2 lg:block">
          <Image src="/event-logo-horizontal.png" alt="CoU AI Hackathon admin" width={1600} height={364} className="logo-adapt h-8 w-auto" />
        </Link>
        <nav aria-label="Admin" className="flex-1 overflow-y-auto">
          <ul className="grid gap-0.5">
            {items.map((i) => (
              <li key={i.href}>
                <Link href={i.href} aria-current={active(i.href) ? "page" : undefined} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors", active(i.href) ? "bg-primary/15 text-fg" : "text-muted hover:bg-fg/[0.05] hover:text-fg")}>
                  <i.icon size={17} aria-hidden /> {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-4 border-t border-line pt-4">
          <Link href="/admin/account" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-fg/[0.05] hover:text-fg">
            <UserCircle size={17} aria-hidden />
            <span className="min-w-0">
              <span className="block truncate text-fg">{name}</span>
              <span className="block text-xs">{role}</span>
            </span>
          </Link>
          <form action={logoutAction}>
            <button className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-fg/[0.05] hover:text-fg">
              <LogOut size={17} aria-hidden /> Sign out
            </button>
          </form>
          <div className="mt-1 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs text-muted hover:text-fg">
              <BarChart3 size={15} aria-hidden /> View public site
            </Link>
            <ThemeToggle className="hidden lg:inline-flex" />
          </div>
        </div>
      </aside>
    </>
  );
}
