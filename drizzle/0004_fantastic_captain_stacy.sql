PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bouts` (
	`id` text PRIMARY KEY NOT NULL,
	`failure_classification_version` integer DEFAULT 1 NOT NULL,
	`file_name` text,
	`video_relative_path` text,
	`video_mime_type` text,
	`video_source_type` text,
	`last_modified` integer NOT NULL,
	`left_fencer` text,
	`right_fencer` text,
	`bout_date` text,
	`bout_date_iso` text,
	`bout_type` text,
	`external_source` text,
	`match_clock_enabled` integer,
	`strip_zone_enabled` integer,
	CONSTRAINT "bouts_video_source_type_valid" CHECK("__new_bouts"."video_source_type" IS NULL OR "__new_bouts"."video_source_type" IN ('library', 'temporary')),
	CONSTRAINT "bouts_failure_classification_version_valid" CHECK("__new_bouts"."failure_classification_version" IN (1, 2))
);
--> statement-breakpoint
INSERT INTO `__new_bouts`("id", "failure_classification_version", "file_name", "video_relative_path", "video_mime_type", "video_source_type", "last_modified", "left_fencer", "right_fencer", "bout_date", "bout_date_iso", "bout_type", "external_source", "match_clock_enabled", "strip_zone_enabled") SELECT "id", 1, "file_name", "video_relative_path", "video_mime_type", "video_source_type", "last_modified", "left_fencer", "right_fencer", "bout_date", "bout_date_iso", "bout_type", "external_source", "match_clock_enabled", "strip_zone_enabled" FROM `bouts`;--> statement-breakpoint
DROP TABLE `bouts`;--> statement-breakpoint
ALTER TABLE `__new_bouts` RENAME TO `bouts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `bouts_left_fencer_idx` ON `bouts` (`left_fencer`);--> statement-breakpoint
CREATE INDEX `bouts_right_fencer_idx` ON `bouts` (`right_fencer`);--> statement-breakpoint
CREATE INDEX `bouts_bout_date_iso_idx` ON `bouts` (`bout_date_iso`);--> statement-breakpoint
CREATE TABLE `__new_tags` (
	`row_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bout_id` text NOT NULL,
	`id` text NOT NULL,
	`position` integer NOT NULL,
	`timestamp` real,
	`seq` integer,
	`created_at` integer NOT NULL,
	`side` text,
	`action` text,
	`mistake` text,
	`failure_mode` text,
	`failure_cause` text,
	`match_period` text,
	`match_clock` text,
	`strip_zone` text,
	FOREIGN KEY (`bout_id`) REFERENCES `bouts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tags_position_nonnegative" CHECK("__new_tags"."position" >= 0),
	CONSTRAINT "tags_side_valid" CHECK("__new_tags"."side" IS NULL OR "__new_tags"."side" IN ('L', 'R')),
	CONSTRAINT "tags_mistake_valid" CHECK("__new_tags"."mistake" IS NULL OR "__new_tags"."mistake" IN ('tactical', 'execution')),
	CONSTRAINT "tags_failure_mode_valid" CHECK("__new_tags"."failure_mode" IS NULL OR "__new_tags"."failure_mode" IN ('technique', 'distance', 'timing', 'action-choice')),
	CONSTRAINT "tags_failure_cause_valid" CHECK("__new_tags"."failure_cause" IS NULL OR "__new_tags"."failure_cause" IN ('read', 'knowledge-gap', 'experiment', 'discipline', 'lapse', 'skill-gap')),
	CONSTRAINT "tags_failure_cause_requires_mode" CHECK("__new_tags"."failure_cause" IS NULL OR "__new_tags"."failure_mode" IS NOT NULL),
	CONSTRAINT "tags_match_period_valid" CHECK("__new_tags"."match_period" IS NULL OR "__new_tags"."match_period" IN ('1', '2', '3', 'priority')),
	CONSTRAINT "tags_strip_zone_valid" CHECK("__new_tags"."strip_zone" IS NULL OR "__new_tags"."strip_zone" IN ('1', '2', '3', '4', '5'))
);
--> statement-breakpoint
INSERT INTO `__new_tags`("row_id", "bout_id", "id", "position", "timestamp", "seq", "created_at", "side", "action", "mistake", "failure_mode", "failure_cause", "match_period", "match_clock", "strip_zone") SELECT "row_id", "bout_id", "id", "position", "timestamp", "seq", "created_at", "side", "action", "mistake", NULL, NULL, "match_period", "match_clock", "strip_zone" FROM `tags`;--> statement-breakpoint
DROP TABLE `tags`;--> statement-breakpoint
ALTER TABLE `__new_tags` RENAME TO `tags`;--> statement-breakpoint
CREATE UNIQUE INDEX `tags_bout_id_id_unique` ON `tags` (`bout_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_bout_position_unique` ON `tags` (`bout_id`,`position`);--> statement-breakpoint
CREATE INDEX `tags_bout_id_idx` ON `tags` (`bout_id`);--> statement-breakpoint
CREATE INDEX `tags_side_idx` ON `tags` (`side`);--> statement-breakpoint
CREATE INDEX `tags_action_idx` ON `tags` (`action`);--> statement-breakpoint
CREATE INDEX `tags_mistake_idx` ON `tags` (`mistake`);--> statement-breakpoint
CREATE INDEX `tags_failure_mode_idx` ON `tags` (`failure_mode`);--> statement-breakpoint
CREATE INDEX `tags_failure_cause_idx` ON `tags` (`failure_cause`);--> statement-breakpoint
CREATE INDEX `tags_match_period_idx` ON `tags` (`match_period`);--> statement-breakpoint
CREATE INDEX `tags_strip_zone_idx` ON `tags` (`strip_zone`);
