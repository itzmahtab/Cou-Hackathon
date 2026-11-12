import { z } from "zod";
import { SHOWCASE_CATEGORIES } from "@/lib/constants";
import { normaliseTransactionId } from "../payments/schema-helpers";
import { collapse, normalisePhone, normaliseStudentId } from "../registration/schema";

export const SHOWCASE_FEE_PER_PERSON = 50;
export const SHOWCASE_MAX_TEAM = 4;

const text = (min: number, max: number, label: string) =>
  z
    .string({ error: `${label} is required.` })
    .transform(collapse)
    .pipe(z.string().min(min, `${label} must be at least ${min} characters.`).max(max, `${label} must be at most ${max} characters.`));

const phone = (label: string) =>
  z
    .string({ error: `${label} is required.` })
    .refine((v) => normalisePhone(v) !== null, `Enter a valid Bangladeshi mobile number (01XXXXXXXXX).`)
    .transform((v) => normalisePhone(v)!);

export const showcaseMemberSchema = z
  .object({
    fullName: text(2, 80, "Full name"),
    studentId: text(2, 40, "Student ID"),
    department: text(2, 80, "Department"),
    session: text(4, 20, "Session"),
    email: z
      .string({ error: "Email is required." })
      .transform((v) => v.trim().toLowerCase())
      .pipe(z.string().email("Enter a valid email address.").max(160)),
    phone: phone("Phone"),
  })
  .strict();

export const showcaseSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    turnstileToken: z.string().max(4096).optional(),
    teamSize: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)], { error: "Team size must be 1 to 4." }),
    members: z.array(showcaseMemberSchema).min(1).max(SHOWCASE_MAX_TEAM),
    project: z
      .object({
        title: text(3, 120, "Project title"),
        category: z.enum(SHOWCASE_CATEGORIES, { error: "Choose a category." }),
        description: z
          .string({ error: "Description is required." })
          .transform((v) => v.normalize("NFC").trim())
          .pipe(z.string().min(30, "Description must be at least 30 characters.").max(1500, "Description must be at most 1,500 characters.")),
      })
      .strict(),
    payment: z
      .object({
        senderPhone: phone("bKash sender number"),
        transactionId: z
          .string({ error: "Transaction ID is required." })
          .transform(normaliseTransactionId)
          .pipe(z.string().regex(/^[A-Z0-9]{6,30}$/, "Enter the bKash transaction ID exactly as shown (letters and digits).")),
      })
      .strict(),
    consents: z
      .object({
        student: z.literal(true, { error: "Confirm that every member is a Comilla University student." }),
        accuracy: z.literal(true, { error: "Confirm that the information is accurate." }),
      })
      .strict(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.members.length !== v.teamSize) {
      ctx.addIssue({ code: "custom", path: ["teamSize"], message: `Team size is ${v.teamSize} but ${v.members.length} member(s) were entered.` });
    }
    const emails = new Set<string>();
    const ids = new Set<string>();
    v.members.forEach((m, i) => {
      if (emails.has(m.email)) ctx.addIssue({ code: "custom", path: ["members", i, "email"], message: "Each member needs a different email." });
      emails.add(m.email);
      const sid = normaliseStudentId(m.studentId);
      if (ids.has(sid)) ctx.addIssue({ code: "custom", path: ["members", i, "studentId"], message: "Two members have the same student ID." });
      ids.add(sid);
    });
  });

export type ShowcaseInput = z.infer<typeof showcaseSchema>;
export type ShowcaseDraft = z.input<typeof showcaseSchema>;
