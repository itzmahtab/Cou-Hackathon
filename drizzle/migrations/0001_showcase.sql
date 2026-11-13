CREATE TABLE `showcase_members` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_id` text NOT NULL,
	`position` integer NOT NULL,
	`full_name` text NOT NULL,
	`student_id` text NOT NULL,
	`student_id_norm` text NOT NULL,
	`department` text NOT NULL,
	`session` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`registration_id`) REFERENCES `showcase_registrations`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "showcase_members_pos_ck" CHECK("showcase_members"."position" between 1 and 4)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `showcase_members_email_uq` ON `showcase_members` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `showcase_members_student_uq` ON `showcase_members` (`student_id_norm`);--> statement-breakpoint
CREATE UNIQUE INDEX `showcase_members_pos_uq` ON `showcase_members` (`registration_id`,`position`);--> statement-breakpoint
CREATE TABLE `showcase_registrations` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_id` text NOT NULL,
	`project_title` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`team_size` integer NOT NULL,
	`fee_bdt` integer NOT NULL,
	`sender_phone` text NOT NULL,
	`transaction_id` text NOT NULL,
	`status` text DEFAULT 'PENDING_VERIFICATION' NOT NULL,
	`rejection_reason` text,
	`internal_note` text,
	`decided_by` text,
	`decided_at` integer,
	`submitted_ip` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`decided_by`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "showcase_size_ck" CHECK("showcase_registrations"."team_size" between 1 and 4),
	CONSTRAINT "showcase_status_ck" CHECK("showcase_registrations"."status" in ('PENDING_VERIFICATION', 'CONFIRMED', 'REJECTED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `showcase_regid_uq` ON `showcase_registrations` (`registration_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `showcase_trx_uq` ON `showcase_registrations` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `showcase_status_ix` ON `showcase_registrations` (`status`);--> statement-breakpoint
CREATE INDEX `showcase_created_ix` ON `showcase_registrations` (`created_at`);