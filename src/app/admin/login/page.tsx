import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { getCtx } from "@/lib/ctx";
import { currentAdmin } from "@/lib/server";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const ctx = getCtx();
  if (await currentAdmin(ctx)) redirect("/admin");
  return (
    <main id="main" className="relative flex min-h-dvh items-center justify-center px-5 py-16">
      <div aria-hidden className="bg-grid absolute inset-0" />
      <div className="card relative w-full max-w-sm p-8">
        <Image src="/event-logo-horizontal.png" alt="CoU AI Hackathon 2026" width={1600} height={364} className="logo-adapt h-9 w-auto" />
        <h1 className="mt-7 text-xl font-semibold">Organiser sign in</h1>
        <p className="mt-1 text-sm text-muted">For hackathon staff only.</p>
        <LoginForm siteKey={ctx.env.TURNSTILE_SITE_KEY} />
      </div>
    </main>
  );
}
