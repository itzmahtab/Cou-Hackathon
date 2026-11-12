"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV } from "@/config/site";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Close the mobile menu after navigation (adjusting state during render, not in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // The registration form gets a focused header: no navigation to wander off to mid-form.
  if (pathname === "/register") {
    return (
      <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex shrink-0 items-center" aria-label="CoU AI Hackathon 2026, home">
            <Image src="/event-logo-horizontal.png" alt="" width={1600} height={364} priority className="logo-adapt h-9 w-auto" />
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <Link href="/" className="btn btn-secondary btn-sm">
              Back to site
            </Link>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className={cn("fixed inset-x-0 top-0 z-50 transition-colors duration-300", scrolled || open ? "border-b border-line bg-bg/80 backdrop-blur-xl" : "border-b border-transparent")}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-primary-strong focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex shrink-0 items-center" aria-label="CoU AI Hackathon 2026, home">
          <Image src="/event-logo-horizontal.png" alt="" width={1600} height={364} priority className="logo-adapt h-9 w-auto" />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} className={cn("rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-fg", pathname === item.href && "text-fg")}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <Link href="/status" className="btn btn-ghost btn-sm hidden sm:inline-flex">
            Check status
          </Link>
          <Link href="/register" className="btn btn-primary btn-sm">
            Register
          </Link>
          <button type="button" className="btn btn-ghost btn-sm lg:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((v) => !v)}>
            {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="container-page grid gap-1 pb-5 lg:hidden">
          {[...NAV, { href: "/status", label: "Check status" }, { href: "/contact", label: "Contact" }].map((item) => (
            <Link key={item.href} href={item.href} className="rounded-lg px-3 py-3 text-base text-fg hover:bg-fg/[0.06]">
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
