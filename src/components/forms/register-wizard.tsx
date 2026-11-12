"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, PartyPopper } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useFieldArray, useForm, type FieldPath } from "react-hook-form";
import { registrationSchema, type RegistrationDraft, type RegistrationInput } from "@/features/registration/schema";
import { cn } from "@/lib/cn";
import { TSHIRT_SIZES } from "@/lib/constants";
import { Field } from "./field";
import { FileDropzone, type UploadedFile } from "./file-dropzone";
import { Turnstile } from "./turnstile";

const STEPS = ["Team", "Participants", "Idea", "Review"] as const;
const DRAFT_KEY = "cou-registration-draft-v1";
const MB = 1024 * 1024;

type Values = RegistrationDraft;
type Files = Record<string, UploadedFile | null>;

const blankPerson = () => ({ fullName: "", email: "", phone: "", whatsapp: "", university: "", studentId: "", tshirtSize: "" as never, idCardFileId: "" });

const defaults = (): Values => ({
  idempotencyKey: crypto.randomUUID(),
  uploadSession: crypto.randomUUID(),
  team: { name: "", size: 1 },
  participants: [blankPerson()],
  idea: { title: "", problemStatement: "", proposedSolution: "", aiComponent: "", expectedImpact: "", documentFileId: "" },
  consents: { rules: false as never, accuracy: false as never, communications: false as never },
});

/** Which wizard step owns a server or schema error path. */
function stepOf(path: string): number {
  if (path.startsWith("team")) return 0;
  if (path.startsWith("participants")) return 1;
  if (path.startsWith("idea")) return 2;
  return 3;
}

export function RegisterWizard({ turnstileSiteKey, announcement, rulesHref = "/rules" }: { turnstileSiteKey?: string; announcement: string; rulesHref?: string }) {
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<Files>({});
  const [sameAsPhone, setSameAsPhone] = useState<boolean[]>([true, true, true]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<{ registrationId: string; teamName: string; participantCount: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  const form = useForm<Values, unknown, RegistrationInput>({ resolver: zodResolver(registrationSchema), defaultValues: useMemo(defaults, []), mode: "onSubmit", reValidateMode: "onSubmit" });
  const { register, control, handleSubmit, setValue, getValues, setError, clearErrors, watch, reset, formState } = form;
  const { errors } = formState;
  const people = useFieldArray({ control, name: "participants" });
  const size = watch("team.size");
  const uploadSession = watch("uploadSession");

  // Restore a draft so a refresh or a dropped connection does not lose the form.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { values: Values; files: Files; step: number; same: boolean[] };
        reset(saved.values);
        setFiles(Object.fromEntries(Object.entries(saved.files).map(([k, v]) => [k, v ? { fileId: v.fileId, name: v.name } : null])));
        setSameAsPhone(saved.same ?? [true, true, true]);
        setStep(Math.min(saved.step ?? 0, 3));
      }
    } catch {
      /* a corrupt draft is ignored */
    }
    setReady(true);
  }, [reset]);

  useEffect(() => {
    if (!ready || done) return;
    const save = () => {
      const { turnstileToken: _omit, ...values } = getValues();
      void _omit;
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ values, files, step, same: sameAsPhone }));
    };
    save();
    const sub = watch(save);
    return () => sub.unsubscribe();
  }, [ready, done, files, step, sameAsPhone, getValues, watch]);

  // An error disappears as soon as the visitor edits that field; the step is re-checked on Continue.
  useEffect(() => {
    const sub = watch((_, { name }) => {
      if (name) clearErrors(name);
    });
    return () => sub.unsubscribe();
  }, [watch, clearErrors]);

  // Keep the participant list the same length as the chosen team size.
  useEffect(() => {
    if (!ready) return;
    const want = Number(size) || 1;
    const have = people.fields.length;
    if (have < want) for (let i = have; i < want; i++) people.append(blankPerson(), { shouldFocus: false });
    if (have > want) for (let i = have - 1; i >= want; i--) people.remove(i);
  }, [size, ready, people]);

  const goTo = (next: number) => {
    setStep(next);
    setFormError(null);
    requestAnimationFrame(() => {
      heading.current?.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const STEP_PREFIX = ["team.", "participants.", "idea.", "consents."];

  /**
   * Validates one step against the shared schema. This runs the same Zod rules
   * the server uses, synchronously, so the result never depends on which
   * fields the visitor happened to touch.
   */
  const validateStep = (s: number): boolean => {
    const prefix = STEP_PREFIX[s];
    const result = registrationSchema.safeParse(getValues());
    const issues = result.success ? [] : result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })).filter((i) => i.path.startsWith(prefix) || (s === 1 && i.path === "team.size"));
    clearErrors(prefix.slice(0, -1) as FieldPath<Values>);
    const seen = new Set<string>();
    for (const issue of issues) {
      if (seen.has(issue.path)) continue;
      seen.add(issue.path);
      setError(issue.path as FieldPath<Values>, { type: "validate", message: issue.message }, { shouldFocus: seen.size === 1 });
    }
    return issues.length === 0;
  };

  const syncWhatsapp = () => getValues("participants").forEach((p, i) => (sameAsPhone[i] ?? true) && setValue(`participants.${i}.whatsapp`, p.phone));

  const next = () => {
    if (step === 1) syncWhatsapp();
    if (validateStep(step)) goTo(step + 1);
    else setFormError("Some fields need attention before you continue.");
  };

  const setFile = (key: string, path: FieldPath<Values>, file: UploadedFile | null) => {
    setFiles((f) => ({ ...f, [key]: file }));
    setValue(path, (file?.fileId ?? "") as never, { shouldValidate: true, shouldDirty: true });
  };

  const onSubmit = (e: React.FormEvent) => {
    syncWhatsapp();
    return submit(e);
  };

  const submit = handleSubmit(
    async (data) => {
      setSubmitting(true);
      setFormError(null);
      try {
        const res = await fetch("/api/v1/registrations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.ok) {
          sessionStorage.removeItem(DRAFT_KEY);
          setDone(json.data);
          window.scrollTo({ top: 0 });
          return;
        }
        const fields: Record<string, string> = json?.error?.fields ?? {};
        const paths = Object.keys(fields);
        paths.forEach((p) => setError(p as FieldPath<Values>, { type: "server", message: fields[p] }));
        setFormError(json?.error?.message ?? "We could not submit your registration. Please try again.");
        if (paths.length) goTo(Math.min(...paths.map(stepOf)));
      } catch {
        setFormError("We could not reach the server. Check your connection and try again. Your answers are saved on this device.");
      } finally {
        setSubmitting(false);
      }
    },
    (invalid) => {
      const first = Math.min(...Object.keys(invalid).map(stepOf));
      setFormError("Some fields need attention.");
      if (Number.isFinite(first) && first !== step) goTo(first);
    },
  );

  if (done) {
    return (
      <div className="card glow-card is-lit mx-auto max-w-2xl p-8 text-center sm:p-12" role="status">
        <PartyPopper size={40} className="mx-auto text-secondary" aria-hidden />
        <h2 className="h2 mt-5">Your idea is in.</h2>
        <p className="mt-3 text-muted">
          Team <strong className="text-fg">{done.teamName}</strong> is registered with {done.participantCount} participant{done.participantCount > 1 ? "s" : ""}.
        </p>
        <p className="eyebrow mt-8 text-muted">Registration ID</p>
        <div className="mt-2 flex items-center justify-center gap-3">
          <p className="font-mono text-3xl font-semibold tracking-wider text-fg sm:text-4xl" data-testid="registration-id">
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
            <Check size={18} className="mt-0.5 shrink-0 text-success" aria-hidden /> Phase 1 is free. There is nothing to pay now.
          </li>
          <li className="flex gap-3">
            <Check size={18} className="mt-0.5 shrink-0 text-success" aria-hidden /> A confirmation email is on its way to every team member. Check spam if it does not arrive.
          </li>
          <li className="flex gap-3">
            <Check size={18} className="mt-0.5 shrink-0 text-success" aria-hidden /> Selection results will be emailed on {announcement}.
          </li>
        </ul>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/status" className="btn btn-primary">
            Check status
          </Link>
          <Link href="/" className="btn btn-secondary">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const v = getValues();
  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto max-w-3xl" aria-labelledby="wizard-heading">
      <ol className="mb-8 flex items-center gap-2" aria-label="Registration progress">
        {STEPS.map((name, i) => (
          <li key={name} aria-current={i === step ? "step" : undefined} className="flex flex-1 items-center gap-2">
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors", i < step ? "border-success/50 bg-success/15 text-success" : i === step ? "border-primary bg-primary-strong text-white" : "border-line text-muted")}>
              {i < step ? <Check size={15} aria-hidden /> : i + 1}
            </span>
            <span className={cn("hidden text-sm sm:block", i === step ? "font-medium text-fg" : "text-muted")}>{name}</span>
            {i < STEPS.length - 1 && <span aria-hidden className={cn("h-px flex-1", i < step ? "bg-success/40" : "bg-line")} />}
          </li>
        ))}
      </ol>
      <p className="mb-2 font-mono text-xs uppercase tracking-[0.16em] text-muted sm:hidden">
        Step {step + 1} of {STEPS.length}
      </p>

      <div className="card p-6 sm:p-9">
        <h2 id="wizard-heading" ref={heading} tabIndex={-1} className="h3 outline-none">
          {["Team information", "Participant information", "Your idea", "Review and confirm"][step]}
        </h2>

        {formError && (
          <p role="alert" className="notice notice-danger mt-5">
            {formError}
          </p>
        )}

        {/* Step 1 */}
        <div hidden={step !== 0} className="mt-7 grid gap-6">
          <Field label="Team name" required error={errors.team?.name?.message} hint="3 to 60 characters. Team names must be unique.">
            <input className="input" autoComplete="off" maxLength={60} {...register("team.name")} />
          </Field>
          <fieldset>
            <legend className="field-label">
              Team size <span className="text-danger" aria-hidden>*</span>
            </legend>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((n) => (
                <label key={n} className={cn("cursor-pointer rounded-xl border p-4 text-center transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary-soft", Number(size) === n ? "border-primary bg-primary/15" : "border-line bg-surface-2/60 hover:border-primary-soft/50")}>
                  <input type="radio" className="sr-only" value={n} checked={Number(size) === n} onChange={() => setValue("team.size", n as 1 | 2 | 3, { shouldValidate: true })} />
                  <span className="block font-mono text-2xl font-semibold">{n}</span>
                  <span className="mt-1 block text-xs text-muted">{["Solo", "Duo", "Trio"][n - 1]}</span>
                </label>
              ))}
            </div>
            {errors.team?.size?.message && (
              <p role="alert" className="field-error">
                {errors.team.size.message}
              </p>
            )}
          </fieldset>
          <p className="notice notice-info">Team members can come from different universities. You will enter each member&apos;s university on the next step.</p>
        </div>

        {/* Step 2 */}
        <div hidden={step !== 1} className="mt-7 grid gap-8">
          {people.fields.map((field, i) => {
            const e = errors.participants?.[i];
            return (
              <fieldset key={field.id} className="rounded-2xl border border-line p-5 sm:p-6">
                <legend className="px-2 text-sm font-semibold">
                  Participant {i + 1} {i === 0 && <span className="badge badge-primary ml-2">Team leader</span>}
                </legend>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Full name" required error={e?.fullName?.message} className="sm:col-span-2">
                    <input className="input" autoComplete="off" {...register(`participants.${i}.fullName`)} />
                  </Field>
                  <Field label="Email address" required error={e?.email?.message} hint="Results and updates are sent here.">
                    <input className="input" type="email" inputMode="email" autoComplete="off" {...register(`participants.${i}.email`)} />
                  </Field>
                  <Field label="Phone number" required error={e?.phone?.message} hint="Bangladeshi mobile, e.g. 01712345678">
                    <input className="input" type="tel" inputMode="tel" autoComplete="off" {...register(`participants.${i}.phone`, { onChange: (ev) => (sameAsPhone[i] ?? true) && setValue(`participants.${i}.whatsapp`, ev.target.value) })} />
                  </Field>
                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#8b5cf6]"
                        checked={sameAsPhone[i] ?? true}
                        onChange={(ev) => {
                          const on = ev.target.checked;
                          setSameAsPhone((s) => s.map((x, j) => (j === i ? on : x)));
                          setValue(`participants.${i}.whatsapp`, on ? getValues(`participants.${i}.phone`) : "");
                        }}
                      />
                      WhatsApp number is the same as the phone number
                    </label>
                    {!(sameAsPhone[i] ?? true) && (
                      <Field label="WhatsApp number" required error={e?.whatsapp?.message} className="mt-4">
                        <input className="input" type="tel" inputMode="tel" autoComplete="off" {...register(`participants.${i}.whatsapp`)} />
                      </Field>
                    )}
                  </div>
                  <Field label="University" required error={e?.university?.message}>
                    <input className="input" autoComplete="off" list="universities" {...register(`participants.${i}.university`)} />
                  </Field>
                  <Field label="Student ID / registration number" required error={e?.studentId?.message}>
                    <input className="input" autoComplete="off" {...register(`participants.${i}.studentId`)} />
                  </Field>
                  <Field label="T-shirt size" required error={e?.tshirtSize?.message}>
                    <select className="input" defaultValue="" {...register(`participants.${i}.tshirtSize`)}>
                      <option value="" disabled>
                        Choose a size
                      </option>
                      {TSHIRT_SIZES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="sm:col-span-2">
                    <Controller
                      control={control}
                      name={`participants.${i}.idCardFileId`}
                      render={() => (
                        <FileDropzone
                          label="Student ID card image"
                          required
                          hint="JPG, PNG or WebP, up to 3 MB"
                          accept="image/jpeg,image/png,image/webp"
                          maxBytes={3 * MB}
                          category="STUDENT_ID"
                          uploadSession={uploadSession}
                          value={files[`id-${field.id}`] ?? null}
                          onChange={(f) => setFile(`id-${field.id}`, `participants.${i}.idCardFileId`, f)}
                          error={e?.idCardFileId?.message}
                        />
                      )}
                    />
                  </div>
                </div>
              </fieldset>
            );
          })}
          <datalist id="universities">
            <option value="Comilla University" />
          </datalist>
        </div>

        {/* Step 3 */}
        <div hidden={step !== 2} className="mt-7 grid gap-6">
          <Field label="Project / idea title" required error={errors.idea?.title?.message}>
            <input className="input" maxLength={120} {...register("idea.title")} />
          </Field>
          {(
            [
              ["problemStatement", "Problem statement", "What problem are you solving, and who has it?"],
              ["proposedSolution", "Proposed solution", "What will you build in five hours?"],
              ["aiComponent", "AI component / technologies", "Which models, data and techniques will you use, and why?"],
              ["expectedImpact", "Expected impact", "Who benefits, and how would you measure it?"],
            ] as const
          ).map(([name, label, hint]) => (
            <Field key={name} label={label} required error={errors.idea?.[name]?.message} hint={`${hint} 50 to 2,000 characters.`}>
              <textarea className="input" maxLength={2000} rows={5} {...register(`idea.${name}`)} />
            </Field>
          ))}
          <Controller
            control={control}
            name="idea.documentFileId"
            render={() => (
              <FileDropzone
                label="Idea document"
                required
                hint="PDF or DOCX, up to 10 MB"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                maxBytes={10 * MB}
                category="IDEA_DOC"
                uploadSession={uploadSession}
                value={files.doc ?? null}
                onChange={(f) => setFile("doc", "idea.documentFileId", f)}
                error={errors.idea?.documentFileId?.message}
              />
            )}
          />
        </div>

        {/* Step 4 */}
        {step === 3 && (
          <div className="mt-7 grid gap-6">
            <section aria-label="Team" className="rounded-2xl border border-line p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Team</h3>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => goTo(0)}>
                  Edit
                </button>
              </div>
              <p className="mt-2 text-lg font-semibold">{v.team.name}</p>
              <p className="text-sm text-muted">
                {v.participants.length} participant{v.participants.length > 1 ? "s" : ""} · {[...new Set(v.participants.map((p) => p.university.trim()).filter(Boolean))].join(", ")}
              </p>
            </section>
            <section aria-label="Participants" className="rounded-2xl border border-line p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Participants</h3>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => goTo(1)}>
                  Edit
                </button>
              </div>
              <ul className="mt-3 grid gap-4">
                {v.participants.map((p, i) => (
                  <li key={i} className="grid gap-1 border-t border-line/60 pt-4 text-sm first:border-t-0 first:pt-0">
                    <p className="font-semibold">
                      {p.fullName} <span className="font-normal text-muted">· {p.tshirtSize}</span>
                    </p>
                    <p className="break-all text-muted">{p.email}</p>
                    <p className="text-muted">
                      {p.phone} · WhatsApp {p.whatsapp}
                    </p>
                    <p className="text-muted">
                      {p.university} · ID {p.studentId}
                    </p>
                    <p className="text-success">ID card image uploaded</p>
                  </li>
                ))}
              </ul>
            </section>
            <section aria-label="Idea" className="rounded-2xl border border-line p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Idea</h3>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => goTo(2)}>
                  Edit
                </button>
              </div>
              <p className="mt-2 text-lg font-semibold">{v.idea.title}</p>
              <dl className="mt-3 grid gap-4 text-sm">
                {(
                  [
                    ["Problem statement", v.idea.problemStatement],
                    ["Proposed solution", v.idea.proposedSolution],
                    ["AI component", v.idea.aiComponent],
                    ["Expected impact", v.idea.expectedImpact],
                  ] as const
                ).map(([k, val]) => (
                  <div key={k}>
                    <dt className="font-medium">{k}</dt>
                    <dd className="mt-1 whitespace-pre-line text-muted">{val}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-sm text-success">Document uploaded{files.doc ? `: ${files.doc.name}` : ""}</p>
            </section>

            <fieldset className="grid gap-3">
              <legend className="field-label">Confirmation</legend>
              {(
                [
                  ["rules", <>I have read and agree to the <Link href={rulesHref} target="_blank" className="text-primary-soft underline underline-offset-4">event rules</Link>.</>],
                  ["accuracy", "I confirm that all the information above is accurate."],
                  ["communications", "I agree to receive emails and messages about this event."],
                ] as const
              ).map(([name, label]) => (
                <div key={name}>
                  <label className="flex items-start gap-3 text-sm">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#8b5cf6]" aria-invalid={errors.consents?.[name] ? "true" : undefined} {...register(`consents.${name}`)} />
                    <span>{label}</span>
                  </label>
                  {errors.consents?.[name]?.message && (
                    <p role="alert" className="field-error ml-7">
                      {errors.consents[name]!.message}
                    </p>
                  )}
                </div>
              ))}
            </fieldset>
            <p className="notice notice-warning">A registration cannot be edited after it is submitted. Check every detail now.</p>
            <Turnstile siteKey={turnstileSiteKey} onToken={(t) => setValue("turnstileToken", t || undefined)} />
          </div>
        )}

        <div className="mt-9 flex items-center justify-between gap-3 border-t border-line pt-6">
          <button type="button" className={cn("btn btn-secondary", step === 0 && "invisible")} onClick={() => goTo(step - 1)} disabled={submitting}>
            <ArrowLeft size={17} aria-hidden /> Back
          </button>
          {step < 3 ? (
            <button type="button" className="btn btn-primary" onClick={next}>
              Continue <ArrowRight size={17} aria-hidden />
            </button>
          ) : (
            <button type="submit" className="btn btn-primary" disabled={submitting} aria-busy={submitting}>
              {submitting && <Loader2 size={17} className="animate-spin" aria-hidden />}
              {submitting ? "Submitting…" : "Submit registration"}
            </button>
          )}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-muted">Your answers are saved on this device until you submit.</p>
    </form>
  );
}
