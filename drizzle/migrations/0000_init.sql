CREATE TABLE `admin_activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_id` text,
	`action` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`detail_json` text,
	`ip` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `logs_created_ix` ON `admin_activity_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `logs_entity_ix` ON `admin_activity_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`admin_id` text NOT NULL,
	`ip` text,
	`user_agent` text,
	`last_seen_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `admin_sessions_admin_ix` ON `admin_sessions` (`admin_id`);--> statement-breakpoint
CREATE INDEX `admin_sessions_exp_ix` ON `admin_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `admins` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`must_change_password` integer DEFAULT true NOT NULL,
	`last_login_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "admins_role_ck" CHECK("admins"."role" in ('SUPER_ADMIN', 'REGISTRATION_ADMIN', 'REVIEWER', 'PAYMENT_ADMIN', 'RESULTS_ADMIN'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admins_email_uq` ON `admins` (`email`);--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`is_published` integer DEFAULT false NOT NULL,
	`published_at` integer,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`team_id` text NOT NULL,
	`checked_in_at` integer NOT NULL,
	`checked_in_by` text NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`checked_in_by`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_participant_uq` ON `attendance` (`participant_id`);--> statement-breakpoint
CREATE INDEX `attendance_team_ix` ON `attendance` (`team_id`);--> statement-breakpoint
CREATE TABLE `email_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`dedupe_key` text NOT NULL,
	`template` text NOT NULL,
	`to_email` text NOT NULL,
	`team_id` text,
	`participant_id` text,
	`payload_json` text NOT NULL,
	`status` text DEFAULT 'QUEUED' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`provider_message_id` text,
	`last_error` text,
	`requested_by` text,
	`sent_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `outbox_dedupe_uq` ON `email_outbox` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `outbox_status_ix` ON `email_outbox` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `outbox_team_ix` ON `email_outbox` (`team_id`);--> statement-breakpoint
CREATE TABLE `event_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`time_label` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_published` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `event_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_by` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`r2_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`original_name` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`upload_session` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "files_category_ck" CHECK("files"."category" in ('STUDENT_ID', 'IDEA_DOC', 'PAYMENT_SCREENSHOT'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `files_key_uq` ON `files` (`r2_key`);--> statement-breakpoint
CREATE INDEX `files_status_ix` ON `files` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `files_session_ix` ON `files` (`upload_session`);--> statement-breakpoint
CREATE TABLE `final_results` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`total_score` real NOT NULL,
	`rank` integer,
	`position` text,
	`prize_bdt` integer,
	`judge_feedback` text,
	`updated_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `results_team_uq` ON `final_results` (`team_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `results_rank_uq` ON `final_results` (`rank`) WHERE rank is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `results_position_uq` ON `final_results` (`position`) WHERE position is not null;--> statement-breakpoint
CREATE TABLE `idea_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`score_relevance` integer NOT NULL,
	`score_innovation` integer NOT NULL,
	`score_ai` integer NOT NULL,
	`score_feasibility` integer NOT NULL,
	`score_impact` integer NOT NULL,
	`total` integer NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_id`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "reviews_rel_ck" CHECK("idea_reviews"."score_relevance" between 0 and 20),
	CONSTRAINT "reviews_inn_ck" CHECK("idea_reviews"."score_innovation" between 0 and 25),
	CONSTRAINT "reviews_ai_ck" CHECK("idea_reviews"."score_ai" between 0 and 25),
	CONSTRAINT "reviews_fea_ck" CHECK("idea_reviews"."score_feasibility" between 0 and 15),
	CONSTRAINT "reviews_imp_ck" CHECK("idea_reviews"."score_impact" between 0 and 15)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_team_reviewer_uq` ON `idea_reviews` (`team_id`,`reviewer_id`);--> statement-breakpoint
CREATE TABLE `idea_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`title` text NOT NULL,
	`problem_statement` text NOT NULL,
	`proposed_solution` text NOT NULL,
	`ai_component` text NOT NULL,
	`expected_impact` text NOT NULL,
	`document_file_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ideas_team_uq` ON `idea_submissions` (`team_id`);--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`key` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`response_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `leaderboard_publications` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`admin_id` text NOT NULL,
	`snapshot_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`position` integer NOT NULL,
	`full_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`whatsapp` text NOT NULL,
	`university` text NOT NULL,
	`university_norm` text NOT NULL,
	`student_id` text NOT NULL,
	`student_id_norm` text NOT NULL,
	`tshirt_size` text NOT NULL,
	`id_card_file_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`id_card_file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "participants_pos_ck" CHECK("participants"."position" between 1 and 3),
	CONSTRAINT "participants_tshirt_ck" CHECK("participants"."tshirt_size" in ('S', 'M', 'L', 'XL', 'XXL', 'XXXL'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participants_email_uq` ON `participants` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `participants_team_pos_uq` ON `participants` (`team_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `participants_student_uq` ON `participants` (`university_norm`,`student_id_norm`);--> statement-breakpoint
CREATE INDEX `participants_uni_ix` ON `participants` (`university_norm`);--> statement-breakpoint
CREATE TABLE `payment_verification_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`admin_id` text NOT NULL,
	`action` text NOT NULL,
	`reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payment_logs_payment_ix` ON `payment_verification_logs` (`payment_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`provider` text NOT NULL,
	`sender_phone` text NOT NULL,
	`transaction_id` text NOT NULL,
	`amount_bdt` integer NOT NULL,
	`screenshot_file_id` text,
	`status` text DEFAULT 'PENDING_VERIFICATION' NOT NULL,
	`rejection_reason` text,
	`internal_note` text,
	`decided_by` text,
	`decided_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`screenshot_file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`decided_by`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "payments_provider_ck" CHECK("payments"."provider" in ('BKASH', 'NAGAD')),
	CONSTRAINT "payments_status_ck" CHECK("payments"."status" in ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_trx_uq` ON `payments` (`provider`,`transaction_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_one_verified_uq` ON `payments` (`team_id`) WHERE status = 'VERIFIED';--> statement-breakpoint
CREATE UNIQUE INDEX `payments_one_pending_uq` ON `payments` (`team_id`) WHERE status = 'PENDING_VERIFICATION';--> statement-breakpoint
CREATE INDEX `payments_team_ix` ON `payments` (`team_id`);--> statement-breakpoint
CREATE INDEX `payments_status_ix` ON `payments` (`status`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`key`, `window_start`)
);
--> statement-breakpoint
CREATE TABLE `shortlist_selections` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text,
	`action` text NOT NULL,
	`justification` text,
	`admin_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "shortlist_override_ck" CHECK("shortlist_selections"."action" <> 'OVERRIDE_ADD' or length(trim(coalesce("shortlist_selections"."justification", ''))) >= 20)
);
--> statement-breakpoint
CREATE INDEX `shortlist_team_ix` ON `shortlist_selections` (`team_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `shortlist_finalise_uq` ON `shortlist_selections` (`action`) WHERE action = 'FINALISE';--> statement-breakpoint
CREATE TABLE `status_otps` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `otps_participant_ix` ON `status_otps` (`participant_id`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_id` text NOT NULL,
	`name` text NOT NULL,
	`name_norm` text NOT NULL,
	`size` integer NOT NULL,
	`status` text DEFAULT 'SUBMITTED' NOT NULL,
	`is_shortlist_candidate` integer DEFAULT false NOT NULL,
	`review_score_avg` real,
	`review_count` integer DEFAULT 0 NOT NULL,
	`submitted_ip` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "teams_size_ck" CHECK("teams"."size" between 1 and 3),
	CONSTRAINT "teams_status_ck" CHECK("teams"."status" in ('SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'NOT_SELECTED', 'CONFIRMED', 'DISQUALIFIED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_regid_uq` ON `teams` (`registration_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `teams_name_uq` ON `teams` (`name_norm`);--> statement-breakpoint
CREATE INDEX `teams_status_ix` ON `teams` (`status`);--> statement-breakpoint
CREATE INDEX `teams_created_ix` ON `teams` (`created_at`);