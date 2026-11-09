CREATE TABLE `auto_tag_job_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` text NOT NULL,
	`seq` integer NOT NULL,
	`kind` text NOT NULL,
	`tag_id` text NOT NULL,
	`snapshot` text,
	`reasoning` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `auto_tag_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "auto_tag_job_events_kind_valid" CHECK("auto_tag_job_events"."kind" IN ('add', 'update', 'delete'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auto_tag_job_events_job_seq_unique` ON `auto_tag_job_events` (`job_id`,`seq`);--> statement-breakpoint
CREATE TABLE `auto_tag_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`bout_id` text NOT NULL,
	`reference_bout_id` text,
	`status` text NOT NULL,
	`agent` text NOT NULL,
	`token_hash` text NOT NULL,
	`video_duration` real,
	`overview_sheet_count` integer,
	`frame_budget` integer NOT NULL,
	`frames_used` integer DEFAULT 0 NOT NULL,
	`write_count` integer DEFAULT 0 NOT NULL,
	`error` text,
	`summary` text,
	`created_at` integer NOT NULL,
	`last_activity_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`bout_id`) REFERENCES `bouts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reference_bout_id`) REFERENCES `bouts`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "auto_tag_jobs_status_valid" CHECK("auto_tag_jobs"."status" IN ('preparing', 'ready', 'running', 'finished', 'cancelled', 'abandoned', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `auto_tag_jobs_bout_id_idx` ON `auto_tag_jobs` (`bout_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `auto_tag_jobs_token_hash_unique` ON `auto_tag_jobs` (`token_hash`);--> statement-breakpoint
ALTER TABLE `tags` ADD `origin` text;--> statement-breakpoint
ALTER TABLE `tags` ADD `auto_tag_job_id` text;--> statement-breakpoint
CREATE INDEX `tags_auto_tag_job_id_idx` ON `tags` (`auto_tag_job_id`);