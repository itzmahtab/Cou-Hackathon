import { z } from "zod";
import { TSHIRT_SIZES } from "@/lib/constants";

export const collapse = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim();
export const normaliseKey = (s: string) => collapse(s).toLowerCase();
/** Student IDs are compared without spaces, dashes or case. */
export const normaliseStudentId = (s: string) => s.normalize("NFC").replace(/[\s\-_/.]/g, "").toLowerCase();

const BD_MOBILE = /^(?:\+?88)?(01[3-9]\d{8})$/;

/** Accepts 01XXXXXXXXX, 8801XXXXXXXXX or +8801XXXXXXXXX; returns +8801XXXXXXXXX or null. */
export function normalisePhone(input: string): string | null {
  const m = BD_MOBILE.exec(input.replace(/[\s\-()]/g, ""));
  return m ? `+88${m[1]}` : null;
}

const text = (min: number, max: number, label: string) =>
  z
    .string({ error: `${label} is required.` })
    .transform(collapse)
    .pipe(z.string().min(min, `${label} must be at least ${min} characters.`).max(max, `${label} must be at most ${max} characters.`));

const longText = (label: string) =>
  z
    .string({ error: `${label} is required.` })
    .transform((s) => s.normalize("NFC").trim())
    .pipe(z.string().min(50, `${label} must be at least 50 characters.`).max(2000, `${label} must be at most 2,000 characters.`));

const phone = (label: string) =>
  z
    .string({ error: `${label} is required.` })
    .refine((v) => normalisePhone(v) !== null, `Enter a valid Bangladeshi mobile number for ${label.toLowerCase()} (01XXXXXXXXX).`)
    .transform((v) => normalisePhone(v)!);

const fileId = (label: string) => z.string({ error: `${label} is required.` }).uuid(`${label} is required.`);

export const participantSchema = z
  .object({
    fullName: text(2, 80, "Full name"),
    email: z
      .string({ error: "Email is required." })
      .transform((s) => s.trim().toLowerCase())
      .pipe(z.string().email("Enter a valid email address.").max(160)),
    phone: phone("Phone"),
    whatsapp: phone("WhatsApp"),
    university: text(2, 120, "University"),
    studentId: text(2, 40, "Student ID"),
    tshirtSize: z.enum(TSHIRT_SIZES, { error: "Choose a T-shirt size." }),
    idCardFileId: fileId("Student ID card image"),
  })
  .strict();

export const ideaSchema = z
  .object({
    title: text(5, 120, "Idea title"),
    problemStatement: longText("Problem statement"),
    proposedSolution: longText("Proposed solution"),
    aiComponent: longText("AI component"),
    expectedImpact: longText("Expected impact"),
    documentFileId: fileId("Idea document"),
  })
  .strict();

export const teamSchema = z
  .object({
    name: text(3, 60, "Team name"),
    size: z.union([z.literal(1), z.literal(2), z.literal(3)], { error: "Team size must be 1, 2 or 3." }),
  })
  .strict();

const mustBeTrue = (message: string) => z.literal(true, { error: message });

export const registrationSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    uploadSession: z.string().uuid(),
    turnstileToken: z.string().max(4096).optional(),
    team: teamSchema,
    participants: z.array(participantSchema).min(1, "Add at least one participant.").max(3, "A team can have at most 3 participants."),
    idea: ideaSchema,
    consents: z
      .object({
        rules: mustBeTrue("You must agree to the event rules."),
        accuracy: mustBeTrue("You must confirm the information is accurate."),
        communications: mustBeTrue("You must consent to event communications."),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.participants.length !== value.team.size) {
      ctx.addIssue({ code: "custom", path: ["team", "size"], message: `Team size is ${value.team.size} but ${value.participants.length} participant(s) were provided.` });
    }
    const seenEmail = new Map<string, number>();
    const seenStudent = new Map<string, number>();
    const seenFile = new Map<string, number>();
    value.participants.forEach((p, i) => {
      if (seenEmail.has(p.email)) ctx.addIssue({ code: "custom", path: ["participants", i, "email"], message: "Each participant needs a different email address." });
      seenEmail.set(p.email, i);
      const key = `${normaliseKey(p.university)}|${normaliseStudentId(p.studentId)}`;
      if (seenStudent.has(key)) ctx.addIssue({ code: "custom", path: ["participants", i, "studentId"], message: "Two participants have the same student ID." });
      seenStudent.set(key, i);
      if (seenFile.has(p.idCardFileId)) ctx.addIssue({ code: "custom", path: ["participants", i, "idCardFileId"], message: "Upload a separate ID card image for each participant." });
      seenFile.set(p.idCardFileId, i);
    });
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;
export type RegistrationDraft = z.input<typeof registrationSchema>;
