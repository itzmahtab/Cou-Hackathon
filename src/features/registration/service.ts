import { and, eq, inArray, or } from "drizzle-orm";
import type { Ctx } from "@/lib/ctx";
import { files, idempotencyKeys, ideaSubmissions, participants, teams } from "@/lib/db/schema";
import { AppError } from "@/lib/http";
import { newRegistrationId, uuid } from "@/lib/ids";
import { getSettings } from "@/lib/settings";
import { formatDhakaDate, windowState } from "@/lib/time";
import { enqueueStatements, statusLink, type OutboxEntry } from "../email/outbox";
import { normaliseKey, normaliseStudentId, type RegistrationInput } from "./schema";

export interface RegistrationResult {
  registrationId: string;
  teamName: string;
  participantCount: number;
}

const DUPLICATE_MESSAGE = "Part of this registration already exists. Check the team name, emails and student IDs.";

export async function registerTeam(ctx: Ctx, input: RegistrationInput, ip: string): Promise<RegistrationResult> {
  // A replayed submit returns the original answer instead of a duplicate error.
  const replay = (await ctx.db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, input.idempotencyKey)).limit(1))[0];
  if (replay) return JSON.parse(replay.responseJson) as RegistrationResult;

  const settings = await getSettings(ctx);
  const state = windowState(ctx.now(), settings.phase1OpenAt, settings.phase1CloseAt);
  if (state === "before") throw new AppError(403, "WINDOW_CLOSED", "Registration has not opened yet.");
  if (state === "closed") throw new AppError(403, "WINDOW_CLOSED", "Phase 1 registration has closed.");

  const nameNorm = normaliseKey(input.team.name);
  const people = input.participants.map((p) => ({
    ...p,
    universityNorm: normaliseKey(p.university),
    studentIdNorm: normaliseStudentId(p.studentId),
  }));

  // Friendly, field-level duplicate errors. The unique indexes remain the real guarantee.
  const fields: Record<string, string> = {};
  const [nameTaken, emailTaken, studentTaken] = await Promise.all([
    ctx.db.select({ id: teams.id }).from(teams).where(eq(teams.nameNorm, nameNorm)).limit(1),
    ctx.db.select({ email: participants.email }).from(participants).where(inArray(participants.email, people.map((p) => p.email))),
    ctx.db
      .select({ u: participants.universityNorm, s: participants.studentIdNorm })
      .from(participants)
      .where(or(...people.map((p) => and(eq(participants.universityNorm, p.universityNorm), eq(participants.studentIdNorm, p.studentIdNorm))))),
  ]);
  if (nameTaken.length) fields["team.name"] = "This team name is already taken. Choose another.";
  people.forEach((p, i) => {
    if (emailTaken.some((r) => r.email === p.email)) fields[`participants.${i}.email`] = "This email is already registered in another team.";
    if (studentTaken.some((r) => r.u === p.universityNorm && r.s === p.studentIdNorm)) {
      fields[`participants.${i}.studentId`] = "This student ID is already registered in another team.";
    }
  });
  if (Object.keys(fields).length) throw new AppError(409, "DUPLICATE", DUPLICATE_MESSAGE, fields);

  // Every referenced file must be a pending upload of the right kind from this form session.
  const wanted = [...people.map((p) => p.idCardFileId), input.idea.documentFileId];
  const found = await ctx.db
    .select({ id: files.id, category: files.category })
    .from(files)
    .where(and(inArray(files.id, wanted), eq(files.status, "PENDING"), eq(files.uploadSession, input.uploadSession)));
  const categoryOf = new Map(found.map((f) => [f.id, f.category]));
  people.forEach((p, i) => {
    if (categoryOf.get(p.idCardFileId) !== "STUDENT_ID") fields[`participants.${i}.idCardFileId`] = "Please upload the student ID card image again.";
  });
  if (categoryOf.get(input.idea.documentFileId) !== "IDEA_DOC") fields["idea.documentFileId"] = "Please upload the idea document again.";
  if (Object.keys(fields).length) throw new AppError(400, "VALIDATION_ERROR", "Some uploads are missing or expired.", fields);

  const now = ctx.now();
  const teamId = uuid();
  const registrationId = newRegistrationId();
  const result: RegistrationResult = { registrationId, teamName: input.team.name, participantCount: people.length };
  const rows = people.map((p, i) => ({
    id: uuid(),
    teamId,
    position: i + 1,
    fullName: p.fullName,
    email: p.email,
    phone: p.phone,
    whatsapp: p.whatsapp,
    university: p.university,
    universityNorm: p.universityNorm,
    studentId: p.studentId,
    studentIdNorm: p.studentIdNorm,
    tshirtSize: p.tshirtSize,
    idCardFileId: p.idCardFileId,
    createdAt: now,
    updatedAt: now,
  }));

  const emails: OutboxEntry[] = await Promise.all(
    rows.map(async (p) => ({
      template: "registration_confirmation" as const,
      to: p.email,
      dedupe: p.id,
      teamId,
      participantId: p.id,
      payload: {
        name: p.fullName,
        teamName: input.team.name,
        registrationId,
        members: rows.map((r) => r.fullName),
        ideaTitle: input.idea.title,
        announcement: settings.shortlistAnnouncement,
        eventDate: formatDhakaDate(settings.eventStartAt),
        venue: settings.venue,
        statusUrl: await statusLink(ctx, p.id),
      },
    })),
  );

  try {
    await ctx.db.batch([
      ctx.db.insert(idempotencyKeys).values({ key: input.idempotencyKey, scope: "registration", responseJson: JSON.stringify(result), createdAt: now }),
      ctx.db.insert(teams).values({ id: teamId, registrationId, name: input.team.name, nameNorm, size: input.team.size, status: "SUBMITTED", submittedIp: ip, createdAt: now, updatedAt: now }),
      ...rows.map((r) => ctx.db.insert(participants).values(r)),
      ctx.db.insert(ideaSubmissions).values({
        id: uuid(),
        teamId,
        title: input.idea.title,
        problemStatement: input.idea.problemStatement,
        proposedSolution: input.idea.proposedSolution,
        aiComponent: input.idea.aiComponent,
        expectedImpact: input.idea.expectedImpact,
        documentFileId: input.idea.documentFileId,
        createdAt: now,
        updatedAt: now,
      }),
      ctx.db.update(files).set({ status: "ATTACHED" }).where(and(inArray(files.id, wanted), eq(files.status, "PENDING"))),
      ...enqueueStatements(ctx, emails),
    ]);
  } catch (err) {
    const message = String((err as Error)?.message ?? err);
    if (/UNIQUE constraint failed/i.test(message)) {
      // Lost a race with a concurrent submit. If it was our own replay, return its answer.
      const again = (await ctx.db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, input.idempotencyKey)).limit(1))[0];
      if (again) return JSON.parse(again.responseJson) as RegistrationResult;
      throw new AppError(409, "DUPLICATE", DUPLICATE_MESSAGE);
    }
    throw err;
  }
  return result;
}
