"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field } from "./field";
import { FileDropzone, type UploadedFile } from "./file-dropzone";
import { Turnstile } from "./turnstile";

async function post(url: string, body: unknown) {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => null);
    return { ok: res.ok && json?.ok, message: json?.error?.message as string | undefined, fields: (json?.error?.fields ?? {}) as Record<string, string> };
  } catch {
    return { ok: false, message: "We could not reach the server. Check your connection and try again.", fields: {} };
  }
}

/** Registration ID + member email, then a one-time code sent to that email. */
export function StatusLookup({ turnstileSiteKey }: { turnstileSiteKey?: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<"identify" | "code">("identify");
  const [registrationId, setRegistrationId] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await post("/api/v1/status/otp", { registrationId: registrationId.trim(), email: email.trim(), turnstileToken: token || undefined });
    setBusy(false);
    setFields(res.fields);
    if (res.ok) setStage("code");
    else setError(res.message ?? "Please check the details and try again.");
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await post("/api/v1/status/verify", { registrationId: registrationId.trim(), email: email.trim(), code: code.trim() });
    setBusy(false);
    setFields(res.fields);
    if (res.ok) router.refresh();
    else setError(res.message ?? "That code is not valid.");
  };

  return (
    <div className="card mx-auto max-w-lg p-6 sm:p-9">
      {error && (
        <p role="alert" className="notice notice-danger mb-5">
          {error}
        </p>
      )}
      {stage === "identify" ? (
        <form onSubmit={requestCode} noValidate className="grid gap-5">
          <Field label="Registration ID" required error={fields.registrationId} hint="It looks like COU26-7K2M9Q and is in your confirmation email.">
            <input className="input font-mono uppercase" value={registrationId} onChange={(e) => setRegistrationId(e.target.value)} autoComplete="off" placeholder="COU26-XXXXXX" required />
          </Field>
          <Field label="Email address" required error={fields.email} hint="The email of any member of your team.">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </Field>
          <Turnstile siteKey={turnstileSiteKey} onToken={setToken} />
          <button className="btn btn-primary" disabled={busy || !registrationId || !email} aria-busy={busy}>
            {busy && <Loader2 size={17} className="animate-spin" aria-hidden />} Email me a code
          </button>
        </form>
      ) : (
        <form onSubmit={verify} noValidate className="grid gap-5">
          <p className="notice notice-info">If those details match a registration, a 6-digit code has been sent to {email}. It expires in 10 minutes.</p>
          <Field label="Verification code" required error={fields.code}>
            <input className="input text-center font-mono text-2xl tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />
          </Field>
          <button className="btn btn-primary" disabled={busy || code.length !== 6} aria-busy={busy}>
            {busy && <Loader2 size={17} className="animate-spin" aria-hidden />} View status
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStage("identify")}>
            Use different details
          </button>
        </form>
      )}
    </div>
  );
}

export function PaymentForm({ registrationId, teamName, feeBdt, screenshotRequired }: { registrationId: string; teamName: string; feeBdt: number; screenshotRequired: boolean }) {
  const router = useRouter();
  const [uploadSession] = useState(() => crypto.randomUUID());
  const [provider, setProvider] = useState<"BKASH" | "NAGAD">("BKASH");
  const [senderPhone, setSenderPhone] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [amount, setAmount] = useState(String(feeBdt));
  const [shot, setShot] = useState<UploadedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await post("/api/v1/payments", { provider, senderPhone, transactionId, amountBdt: Number(amount), screenshotFileId: shot?.fileId ?? null, uploadSession });
    setBusy(false);
    setFields(res.fields);
    if (res.ok) router.refresh();
    else setError(res.message ?? "We could not submit the payment. Please try again.");
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      {error && (
        <p role="alert" className="notice notice-danger">
          {error}
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Registration ID">
          <input className="input font-mono" value={registrationId} readOnly />
        </Field>
        <Field label="Team name">
          <input className="input" value={teamName} readOnly />
        </Field>
      </div>
      <fieldset>
        <legend className="field-label">
          Payment method <span className="text-danger" aria-hidden>*</span>
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {(["BKASH", "NAGAD"] as const).map((p) => (
            <label key={p} className={`cursor-pointer rounded-xl border p-4 text-center font-semibold transition-colors ${provider === p ? "border-primary bg-primary/15" : "border-line bg-surface-2/60"}`}>
              <input type="radio" name="provider" className="sr-only" checked={provider === p} onChange={() => setProvider(p)} />
              {p === "BKASH" ? "bKash" : "Nagad"}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Sender number" required error={fields.senderPhone} hint="The number the money was sent from.">
          <input className="input" type="tel" inputMode="tel" value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} placeholder="01XXXXXXXXX" required />
        </Field>
        <Field label="Transaction ID" required error={fields.transactionId} hint="Exactly as shown in the app or SMS.">
          <input className="input font-mono uppercase" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} autoComplete="off" required />
        </Field>
      </div>
      <Field label="Amount sent (BDT)" required error={fields.amountBdt} hint={`The team fee is BDT ${feeBdt.toLocaleString("en-US")}.`}>
        <input className="input font-mono" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} required />
      </Field>
      <FileDropzone
        label={`Payment screenshot${screenshotRequired ? "" : " (optional)"}`}
        required={screenshotRequired}
        hint="JPG, PNG or WebP, up to 3 MB"
        accept="image/jpeg,image/png,image/webp"
        maxBytes={3 * 1024 * 1024}
        category="PAYMENT_SCREENSHOT"
        uploadSession={uploadSession}
        value={shot}
        onChange={setShot}
        error={fields.screenshotFileId}
      />
      <button className="btn btn-primary" disabled={busy} aria-busy={busy}>
        {busy && <Loader2 size={17} className="animate-spin" aria-hidden />} Submit payment details
      </button>
    </form>
  );
}
