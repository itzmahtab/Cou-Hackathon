"use client";

import { Check, Clock, Copy, Loader2, Mail, Send } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatPhone } from "@/config/content";
import { SHOWCASE } from "@/config/showcase";
import { SHOWCASE_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { SHOWCASE_FEE_PER_TEAM, showcaseSchema } from "@/features/showcase/schema";
import { Field } from "./field";
import { Turnstile } from "./turnstile";

type Member = { fullName: string; studentId: string; department: string; session: string; email: string; phone: string };
const blank = (): Member => ({ fullName: "", studentId: "", department: "", session: "", email: "", phone: "" });

/** Single-page showcase registration. Validated with the same schema as the server. */
export function ShowcaseForm({ turnstileSiteKey }: { turnstileSiteKey?: string }) {
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const [size, setSize] = useState(1);
  const [members, setMembers] = useState<Member[]>([blank(), blank(), blank(), blank()]);
  const [project, setProject] = useState({ title: "", category: "", description: "" });
  const [payment, setPayment] = useState({ senderPhone: "", transactionId: "" });
  const [consents, setConsents] = useState({ student: false, accuracy: false });
  const [token, setToken] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ registrationId: string; feeBdt: number; teamSize: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const fee = SHOWCASE_FEE_PER_TEAM;
  const err = (k: string) => errors[k];
  const setMember = (i: number, k: keyof Member, v: string) => setMembers((ms) => ms.map((m, j) => (j === i ? { ...m, [k]: v } : m)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setFormError(null);
    const body = { idempotencyKey, turnstileToken: token || undefined, teamSize: size, members: members.slice(0, size), project, payment, consents };
    const parsed = showcaseSchema.safeParse(body);
    if (!parsed.success) {
      const f: Record<string, string> = {};
      for (const i of parsed.error.issues) f[i.path.join(".")] ??= i.message;
      setErrors(f);
      setFormError("Some fields need attention.");
      document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ block: "center" });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await fetch("/api/v1/showcase", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setDone(json.data);
        window.scrollTo({ top: 0 });
        return;
      }
      setErrors(json?.error?.fields ?? {});
      setFormError(json?.error?.message ?? "We could not submit your registration. Please try again.");
    } catch {
      setFormError("We could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="card glow-card is-lit mx-auto max-w-2xl p-8 text-center sm:p-12" role="status">
        <Send size={40} className="mx-auto text-secondary" aria-hidden />
        <h2 className="h2 mt-5">Registration submitted</h2>
        <p className="mt-3 text-muted">
          {done.teamSize} participant{done.teamSize > 1 ? "s" : ""} · BDT {done.feeBdt} sent by bKash
        </p>
        <p className="notice notice-info mx-auto mt-6 max-w-md text-left text-sm">
          <strong>Payment pending verification.</strong> Your place is not confirmed yet. An organiser will check your bKash payment, and you will receive a confirmation email once it is verified.
        </p>
        <p className="eyebrow mt-8 text-muted">Registration ID</p>
        <div className="mt-2 flex items-center justify-center gap-3">
          <p className="font-mono text-3xl font-semibold tracking-wider sm:text-4xl" data-testid="showcase-id">
            {done.registrationId}
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              void navigator.clipboard?.writeText(done.registrationId);
              setCopied(true);
            }}
          >
            {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <ul className="mx-auto mt-8 max-w-md space-y-3 text-left text-sm text-muted">
          <li className="flex gap-3">
            <Mail size={18} className="mt-0.5 shrink-0 text-secondary" aria-hidden /> Every member now gets an email saying the registration was received.
          </li>
          <li className="flex gap-3">
            <Clock size={18} className="mt-0.5 shrink-0 text-secondary" aria-hidden /> After an organiser verifies the payment, every member gets a confirmation email. If the payment cannot be verified, we will email you what to do.
          </li>
          <li className="flex gap-3">
            <Check size={18} className="mt-0.5 shrink-0 text-success" aria-hidden /> Once confirmed, bring your project and student ID card on {SHOWCASE.eventDate}.
          </li>
        </ul>
        <Link href="/showcase" className="btn btn-secondary mt-9">
          Back to the showcase
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto grid max-w-3xl gap-6">
      {formError && (
        <p role="alert" className="notice notice-danger">
          {formError}
        </p>
      )}

      <section className="card p-6 sm:p-8" aria-labelledby="sc-team">
        <h2 id="sc-team" className="h3">
          Team
        </h2>
        <fieldset className="mt-5">
          <legend className="field-label">
            Number of members <span className="text-danger" aria-hidden>*</span>
          </legend>
          <p className="mb-3 text-sm text-muted">The fee is BDT {SHOWCASE_FEE_PER_TEAM} for the whole team, whatever its size.</p>
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((n) => (
              <label key={n} className={cn("cursor-pointer rounded-xl border p-3 text-center transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary-soft", size === n ? "border-primary bg-primary/15" : "border-line bg-surface-2/60 hover:border-primary-soft/50")}>
                <input type="radio" name="size" className="sr-only" checked={size === n} onChange={() => setSize(n)} />
                <span className="block font-mono text-2xl font-semibold">{n}</span>
                <span className="block text-xs text-muted">{n === 1 ? "member" : "members"}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-6 grid gap-6">
          {members.slice(0, size).map((m, i) => (
            <fieldset key={i} className="rounded-2xl border border-line p-5">
              <legend className="px-2 text-sm font-semibold">
                Member {i + 1} {i === 0 && <span className="badge badge-primary ml-2">Team leader</span>}
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" required error={err(`members.${i}.fullName`)} className="sm:col-span-2">
                  <input className="input" value={m.fullName} onChange={(e) => setMember(i, "fullName", e.target.value)} autoComplete="off" />
                </Field>
                <Field label="Student ID" required error={err(`members.${i}.studentId`)}>
                  <input className="input" value={m.studentId} onChange={(e) => setMember(i, "studentId", e.target.value)} autoComplete="off" />
                </Field>
                <Field label="Department" required error={err(`members.${i}.department`)} hint="e.g. CSE, ICT, EEE">
                  <input className="input" value={m.department} onChange={(e) => setMember(i, "department", e.target.value)} autoComplete="off" />
                </Field>
                <Field label="Session" required error={err(`members.${i}.session`)} hint="e.g. 2021-22">
                  <input className="input" value={m.session} onChange={(e) => setMember(i, "session", e.target.value)} autoComplete="off" />
                </Field>
                <Field label="Phone" required error={err(`members.${i}.phone`)}>
                  <input className="input" type="tel" inputMode="tel" value={m.phone} onChange={(e) => setMember(i, "phone", e.target.value)} placeholder="01XXXXXXXXX" />
                </Field>
                <Field label="Email" required error={err(`members.${i}.email`)} className="sm:col-span-2" hint="The confirmation is sent here.">
                  <input className="input" type="email" inputMode="email" value={m.email} onChange={(e) => setMember(i, "email", e.target.value)} />
                </Field>
              </div>
            </fieldset>
          ))}
        </div>
        {err("teamSize") && (
          <p role="alert" className="field-error">
            {err("teamSize")}
          </p>
        )}
      </section>

      <section className="card p-6 sm:p-8" aria-labelledby="sc-project">
        <h2 id="sc-project" className="h3">
          Project
        </h2>
        <div className="mt-5 grid gap-5">
          <Field label="Project title" required error={err("project.title")}>
            <input className="input" maxLength={120} value={project.title} onChange={(e) => setProject({ ...project, title: e.target.value })} />
          </Field>
          <Field label="Category" required error={err("project.category")}>
            <select className="input" value={project.category} onChange={(e) => setProject({ ...project, category: e.target.value })}>
              <option value="" disabled>
                Choose a category
              </option>
              {SHOWCASE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Short description" required error={err("project.description")} hint="What it does and how it works. 30 to 1,500 characters.">
            <textarea className="input" rows={5} maxLength={1500} value={project.description} onChange={(e) => setProject({ ...project, description: e.target.value })} />
          </Field>
        </div>
      </section>

      <section className="card p-6 sm:p-8" aria-labelledby="sc-pay">
        <h2 id="sc-pay" className="h3">
          Payment
        </h2>
        <div className="mt-4 rounded-xl border border-primary/40 bg-primary/[0.06] p-4 text-sm">
          <p>
            Send <strong className="font-mono text-base">BDT {fee}</strong> (one fee for the whole team) by <strong>bKash Send Money</strong> to{" "}
            <strong className="whitespace-nowrap font-mono text-base">{formatPhone(SHOWCASE.bkash)}</strong>, then enter the details below.
          </p>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="bKash number you paid from" required error={err("payment.senderPhone")}>
            <input className="input" type="tel" inputMode="tel" value={payment.senderPhone} onChange={(e) => setPayment({ ...payment, senderPhone: e.target.value })} placeholder="01XXXXXXXXX" />
          </Field>
          <Field label="bKash transaction ID" required error={err("payment.transactionId")}>
            <input className="input font-mono uppercase" value={payment.transactionId} onChange={(e) => setPayment({ ...payment, transactionId: e.target.value })} autoComplete="off" />
          </Field>
        </div>
      </section>

      <section className="card grid gap-3 p-6 sm:p-8" aria-label="Confirmation">
        {(
          [
            ["student", "Every member is a current student of Comilla University."],
            ["accuracy", "The information above is accurate."],
          ] as const
        ).map(([k, label]) => (
          <div key={k}>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#8b5cf6]" checked={consents[k]} aria-invalid={err(`consents.${k}`) ? "true" : undefined} onChange={(e) => setConsents({ ...consents, [k]: e.target.checked })} />
              <span>{label}</span>
            </label>
            {err(`consents.${k}`) && (
              <p role="alert" className="field-error ml-7">
                {err(`consents.${k}`)}
              </p>
            )}
          </div>
        ))}
        <Turnstile siteKey={turnstileSiteKey} onToken={setToken} />
        <button className="btn btn-primary mt-2" disabled={busy} aria-busy={busy}>
          {busy && <Loader2 size={17} className="animate-spin" aria-hidden />}
          {busy ? "Submitting…" : `Register and submit payment (BDT ${fee})`}
        </button>
      </section>
    </form>
  );
}
