CREATE TABLE `heart_rate_imports` (
	`bout_id` text PRIMARY KEY NOT NULL,
	`video_started_at` integer NOT NULL,
	`video_duration` real NOT NULL,
	`timing_source` text NOT NULL,
	`source_name` text,
	`birth_date` text,
	`max_heart_rate` integer NOT NULL,
	`extracted_at` integer NOT NULL,
	FOREIGN KEY (`bout_id`) REFERENCES `bouts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "heart_rate_imports_timing_source_valid" CHECK("heart_rate_imports"."timing_source" IN ('embedded', 'fileModified')),
	CONSTRAINT "heart_rate_imports_duration_positive" CHECK("heart_rate_imports"."video_duration" > 0)
);
--> statement-breakpoint
CREATE TABLE `heart_rate_samples` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bout_id` text NOT NULL,
	`timestamp` real NOT NULL,
	`recorded_at` integer NOT NULL,
	`bpm` real NOT NULL,
	`zone` text NOT NULL,
	FOREIGN KEY (`bout_id`) REFERENCES `heart_rate_imports`(`bout_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "heart_rate_samples_timestamp_nonnegative" CHECK("heart_rate_samples"."timestamp" >= 0),
	CONSTRAINT "heart_rate_samples_bpm_positive" CHECK("heart_rate_samples"."bpm" > 0),
	CONSTRAINT "heart_rate_samples_zone_valid" CHECK("heart_rate_samples"."zone" IN ('zone1', 'zone2', 'zone3', 'zone4', 'zone5'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `heart_rate_samples_bout_recorded_unique` ON `heart_rate_samples` (`bout_id`,`recorded_at`);--> statement-breakpoint
CREATE INDEX `heart_rate_samples_bout_timestamp_idx` ON `heart_rate_samples` (`bout_id`,`timestamp`);