import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const createdAt = () => integer("created_at").notNull();
const updatedAt = () => integer("updated_at").notNull();

import { ADMIN_ROLES, EMAIL_STATUSES, FILE_CATEGORIES, PAYMENT_PROVIDERS, PAYMENT_STATUSES, POSITIONS, TEAM_STATUSES, TSHIRT_SIZES } from "../constants";

export { ADMIN_ROLES, EMAIL_STATUSES, FILE_CATEGORIES, PAYMENT_PROVIDERS, PAYMENT_STATUSES, POSITIONS, TEAM_STATUSES, TSHIRT_SIZES };

const inList = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(", "));

export const admins = sqliteTable(
  "admins",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ADMIN_ROLES }).notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(true),
    lastLoginAt: integer("last_login_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("admins_email_uq").on(t.email), check("admins_role_ck", sql`${t.role} in (${inList(ADMIN_ROLES)})`)],
);

export const adminSessions = sqliteTable(
  "admin_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    adminId: text("admin_id").notNull().references(() => admins.id, { onDelete: "cascade" }),
    ip: text("ip"),
    userAgent: text("user_agent"),
    lastSeenAt: integer("last_seen_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("admin_sessions_admin_ix").on(t.adminId), index("admin_sessions_exp_ix").on(t.expiresAt)],
);

export const files = sqliteTable(
  "files",
  {
    id: id(),
    category: text("category", { enum: FILE_CATEGORIES }).notNull(),
    r2Key: text("r2_key").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    originalName: text("original_name"),
    status: text("status", { enum: ["PENDING", "ATTACHED", "DELETED"] }).notNull().default("PENDING"),
    uploadSession: text("upload_session").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("files_key_uq").on(t.r2Key),
    index("files_status_ix").on(t.status, t.createdAt),
    index("files_session_ix").on(t.uploadSession),
    check("files_category_ck", sql`${t.category} in (${inList(FILE_CATEGORIES)})`),
  ],
);

export const teams = sqliteTable(
  "teams",
  {
    id: id(),
    registrationId: text("registration_id").notNull(),
    name: text("name").notNull(),
    nameNorm: text("name_norm").notNull(),
    size: integer("size").notNull(),
    status: text("status", { enum: TEAM_STATUSES }).notNull().default("SUBMITTED"),
    isShortlistCandidate: integer("is_shortlist_candidate", { mode: "boolean" }).notNull().default(false),
    reviewScoreAvg: real("review_score_avg"),
    reviewCount: integer("review_count").notNull().default(0),
    submittedIp: text("submitted_ip"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("teams_regid_uq").on(t.registrationId),
    uniqueIndex("teams_name_uq").on(t.nameNorm),
    index("teams_status_ix").on(t.status),
    index("teams_created_ix").on(t.createdAt),
    check("teams_size_ck", sql`${t.size} between 1 and 3`),
    check("teams_status_ck", sql`${t.status} in (${inList(TEAM_STATUSES)})`),
  ],
);

export const participants = sqliteTable(
  "participants",
  {
    id: id(),
    teamId: text("team_id").notNull().references(() => teams.id),
    position: integer("position").notNull(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    whatsapp: text("whatsapp").notNull(),
    university: text("university").notNull(),
    universityNorm: text("university_norm").notNull(),
    studentId: text("student_id").notNull(),
    studentIdNorm: text("student_id_norm").notNull(),
    tshirtSize: text("tshirt_size", { enum: TSHIRT_SIZES }).notNull(),
    idCardFileId: text("id_card_file_id").references(() => files.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("participants_email_uq").on(t.email),
    uniqueIndex("participants_team_pos_uq").on(t.teamId, t.position),
    uniqueIndex("participants_student_uq").on(t.universityNorm, t.studentIdNorm),
    index("participants_uni_ix").on(t.universityNorm),
    check("participants_pos_ck", sql`${t.position} between 1 and 3`),
    check("participants_tshirt_ck", sql`${t.tshirtSize} in (${inList(TSHIRT_SIZES)})`),
  ],
);

export const ideaSubmissions = sqliteTable(
  "idea_submissions",
  {
    id: id(),
    teamId: text("team_id").notNull().references(() => teams.id),
    title: text("title").notNull(),
    problemStatement: text("problem_statement").notNull(),
    proposedSolution: text("proposed_solution").notNull(),
    aiComponent: text("ai_component").notNull(),
    expectedImpact: text("expected_impact").notNull(),
    documentFileId: text("document_file_id").references(() => files.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("ideas_team_uq").on(t.teamId)],
);

export const ideaReviews = sqliteTable(
  "idea_reviews",
  {
    id: id(),
    teamId: text("team_id").notNull().references(() => teams.id),
    reviewerId: text("reviewer_id").notNull().references(() => admins.id),
    scoreRelevance: integer("score_relevance").notNull(),
    scoreInnovation: integer("score_innovation").notNull(),
    scoreAi: integer("score_ai").notNull(),
    scoreFeasibility: integer("score_feasibility").notNull(),
    scoreImpact: integer("score_impact").notNull(),
    total: integer("total").notNull(),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("reviews_team_reviewer_uq").on(t.teamId, t.reviewerId),
    check("reviews_rel_ck", sql`${t.scoreRelevance} between 0 and 20`),
    check("reviews_inn_ck", sql`${t.scoreInnovation} between 0 and 25`),
    check("reviews_ai_ck", sql`${t.scoreAi} between 0 and 25`),
    check("reviews_fea_ck", sql`${t.scoreFeasibility} between 0 and 15`),
    check("reviews_imp_ck", sql`${t.scoreImpact} between 0 and 15`),
  ],
);

export const shortlistSelections = sqliteTable(
  "shortlist_selections",
  {
    id: id(),
    teamId: text("team_id").references(() => teams.id),
    action: text("action", { enum: ["ADD", "REMOVE", "OVERRIDE_ADD", "FINALISE"] }).notNull(),
    justification: text("justification"),
    adminId: text("admin_id").notNull().references(() => admins.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("shortlist_team_ix").on(t.teamId),
    // At most one FINALISE row can exist: this is what makes finalisation one-shot.
    uniqueIndex("shortlist_finalise_uq").on(t.action).where(sql`action = 'FINALISE'`),
    check("shortlist_override_ck", sql`${t.action} <> 'OVERRIDE_ADD' or length(trim(coalesce(${t.justification}, ''))) >= 20`),
  ],
);

export const payments = sqliteTable(
  "payments",
  {
    id: id(),
    teamId: text("team_id").notNull().references(() => teams.id),
    provider: text("provider", { enum: PAYMENT_PROVIDERS }).notNull(),
    senderPhone: text("sender_phone").notNull(),
    transactionId: text("transaction_id").notNull(),
    amountBdt: integer("amount_bdt").notNull(),
    screenshotFileId: text("screenshot_file_id").references(() => files.id),
    status: text("status", { enum: PAYMENT_STATUSES }).notNull().default("PENDING_VERIFICATION"),
    rejectionReason: text("rejection_reason"),
    internalNote: text("internal_note"),
    decidedBy: text("decided_by").references(() => admins.id),
    decidedAt: integer("decided_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("payments_trx_uq").on(t.provider, t.transactionId),
    uniqueIndex("payments_one_verified_uq").on(t.teamId).where(sql`status = 'VERIFIED'`),
    uniqueIndex("payments_one_pending_uq").on(t.teamId).where(sql`status = 'PENDING_VERIFICATION'`),
    index("payments_team_ix").on(t.teamId),
    index("payments_status_ix").on(t.status),
    check("payments_provider_ck", sql`${t.provider} in (${inList(PAYMENT_PROVIDERS)})`),
    check("payments_status_ck", sql`${t.status} in (${inList(PAYMENT_STATUSES)})`),
  ],
);

export const paymentVerificationLogs = sqliteTable(
  "payment_verification_logs",
  {
    id: id(),
    paymentId: text("payment_id").notNull().references(() => payments.id),
    adminId: text("admin_id").notNull().references(() => admins.id),
    action: text("action", { enum: ["VERIFY", "REJECT", "NOTE"] }).notNull(),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [index("payment_logs_payment_ix").on(t.paymentId)],
);

export const emailOutbox = sqliteTable(
  "email_outbox",
  {
    id: id(),
    dedupeKey: text("dedupe_key").notNull(),
    template: text("template").notNull(),
    toEmail: text("to_email").notNull(),
    teamId: text("team_id").references(() => teams.id),
    participantId: text("participant_id").references(() => participants.id),
    payloadJson: text("payload_json").notNull(),
    status: text("status", { enum: EMAIL_STATUSES }).notNull().default("QUEUED"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: integer("next_attempt_at").notNull(),
    providerMessageId: text("provider_message_id"),
    lastError: text("last_error"),
    requestedBy: text("requested_by").references(() => admins.id),
    sentAt: integer("sent_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("outbox_dedupe_uq").on(t.dedupeKey),
    index("outbox_status_ix").on(t.status, t.nextAttemptAt),
    index("outbox_team_ix").on(t.teamId),
  ],
);

export const eventSettings = sqliteTable("event_settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedBy: text("updated_by").references(() => admins.id),
  updatedAt: updatedAt(),
});

export const eventSchedules = sqliteTable("event_schedules", {
  id: id(),
  title: text("title").notNull(),
  description: text("description"),
  timeLabel: text("time_label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const announcements = sqliteTable("announcements", {
  id: id(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(false),
  publishedAt: integer("published_at"),
  createdBy: text("created_by").references(() => admins.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const attendance = sqliteTable(
  "attendance",
  {
    id: id(),
    participantId: text("participant_id").notNull().references(() => participants.id),
    teamId: text("team_id").notNull().references(() => teams.id),
    checkedInAt: integer("checked_in_at").notNull(),
    checkedInBy: text("checked_in_by").notNull().references(() => admins.id),
  },
  (t) => [uniqueIndex("attendance_participant_uq").on(t.participantId), index("attendance_team_ix").on(t.teamId)],
);

export const finalResults = sqliteTable(
  "final_results",
  {
    id: id(),
    teamId: text("team_id").notNull().references(() => teams.id),
    totalScore: real("total_score").notNull(),
    rank: integer("rank"),
    position: text("position", { enum: POSITIONS }),
    prizeBdt: integer("prize_bdt"),
    judgeFeedback: text("judge_feedback"),
    updatedBy: text("updated_by").references(() => admins.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("results_team_uq").on(t.teamId),
    uniqueIndex("results_rank_uq").on(t.rank).where(sql`rank is not null`),
    uniqueIndex("results_position_uq").on(t.position).where(sql`position is not null`),
  ],
);

export const leaderboardPublications = sqliteTable("leaderboard_publications", {
  id: id(),
  action: text("action", { enum: ["PUBLISH", "UNPUBLISH"] }).notNull(),
  adminId: text("admin_id").notNull().references(() => admins.id),
  snapshotJson: text("snapshot_json"),
  createdAt: createdAt(),
});

export const adminActivityLogs = sqliteTable(
  "admin_activity_logs",
  {
    id: id(),
    adminId: text("admin_id").references(() => admins.id),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    detailJson: text("detail_json"),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("logs_created_ix").on(t.createdAt), index("logs_entity_ix").on(t.entityType, t.entityId)],
);

export const statusOtps = sqliteTable(
  "status_otps",
  {
    id: id(),
    participantId: text("participant_id").notNull().references(() => participants.id),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: integer("expires_at").notNull(),
    consumedAt: integer("consumed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("otps_participant_ix").on(t.participantId)],
);

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: integer("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export const idempotencyKeys = sqliteTable("idempotency_keys", {
  key: text("key").primaryKey(),
  scope: text("scope").notNull(),
  responseJson: text("response_json").notNull(),
  createdAt: createdAt(),
});

export type Admin = typeof admins.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Participant = typeof participants.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type AdminRole = (typeof ADMIN_ROLES)[number];
export type TeamStatus = (typeof TEAM_STATUSES)[number];
