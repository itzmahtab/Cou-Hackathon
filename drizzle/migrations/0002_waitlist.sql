ALTER TABLE `teams` ADD `waitlist_position` integer;--> statement-breakpoint
CREATE INDEX `teams_waitlist_ix` ON `teams` (`waitlist_position`);