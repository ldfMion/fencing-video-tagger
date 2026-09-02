ALTER TABLE `tags` RENAME TO `tags_legacy`;
--> statement-breakpoint
ALTER TABLE `sessions` RENAME TO `sessions_legacy`;
--> statement-breakpoint
CREATE TABLE `bouts` (
	`id` text PRIMARY KEY NOT NULL,
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
	CONSTRAINT `bouts_video_source_type_valid`
		CHECK (`video_source_type` IS NULL OR `video_source_type` IN ('library', 'temporary'))
);
--> statement-breakpoint
CREATE INDEX `bouts_left_fencer_idx` ON `bouts` (`left_fencer`);
--> statement-breakpoint
CREATE INDEX `bouts_right_fencer_idx` ON `bouts` (`right_fencer`);
--> statement-breakpoint
CREATE INDEX `bouts_bout_date_iso_idx` ON `bouts` (`bout_date_iso`);
--> statement-breakpoint
CREATE TABLE `tags` (
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
	`match_period` text,
	`match_clock` text,
	`strip_zone` text,
	FOREIGN KEY (`bout_id`) REFERENCES `bouts` (`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `tags_position_nonnegative` CHECK (`position` >= 0),
	CONSTRAINT `tags_side_valid` CHECK (`side` IS NULL OR `side` IN ('L', 'R')),
	CONSTRAINT `tags_mistake_valid` CHECK (`mistake` IS NULL OR `mistake` IN ('tactical', 'execution')),
	CONSTRAINT `tags_match_period_valid` CHECK (`match_period` IS NULL OR `match_period` IN ('1', '2', '3', 'priority')),
	CONSTRAINT `tags_strip_zone_valid` CHECK (`strip_zone` IS NULL OR `strip_zone` IN ('1', '2', '3', '4', '5'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_bout_id_id_unique` ON `tags` (`bout_id`, `id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_bout_position_unique` ON `tags` (`bout_id`, `position`);
--> statement-breakpoint
CREATE INDEX `tags_bout_id_idx` ON `tags` (`bout_id`);
--> statement-breakpoint
CREATE INDEX `tags_side_idx` ON `tags` (`side`);
--> statement-breakpoint
CREATE INDEX `tags_action_idx` ON `tags` (`action`);
--> statement-breakpoint
CREATE INDEX `tags_mistake_idx` ON `tags` (`mistake`);
--> statement-breakpoint
CREATE INDEX `tags_match_period_idx` ON `tags` (`match_period`);
--> statement-breakpoint
CREATE INDEX `tags_strip_zone_idx` ON `tags` (`strip_zone`);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tag_row_id` integer NOT NULL UNIQUE,
	`body` text NOT NULL,
	`content_hash` text NOT NULL,
	FOREIGN KEY (`tag_row_id`) REFERENCES `tags` (`row_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `comments_tag_row_id_idx` ON `comments` (`tag_row_id`);
--> statement-breakpoint
CREATE TABLE `comment_embeddings` (
	`comment_id` integer PRIMARY KEY NOT NULL,
	`embedding` F32_BLOB(256) NOT NULL,
	`model_id` text NOT NULL,
	`model_revision` text NOT NULL,
	`artifact_id` text NOT NULL,
	`artifact_revision` text NOT NULL,
	`prompt_version` text NOT NULL,
	`dimensions` integer NOT NULL,
	`comment_hash` text NOT NULL,
	`generated_at` integer NOT NULL,
	FOREIGN KEY (`comment_id`) REFERENCES `comments` (`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `comment_embeddings_dimensions_256` CHECK (`dimensions` = 256)
);
--> statement-breakpoint
CREATE INDEX `comment_embeddings_vector_idx`
	ON `comment_embeddings` (libsql_vector_idx(`embedding`, 'metric=cosine'));
--> statement-breakpoint
INSERT INTO `bouts` (
	`id`, `file_name`, `video_relative_path`, `video_mime_type`,
	`video_source_type`, `last_modified`, `left_fencer`, `right_fencer`,
	`bout_date`, `bout_date_iso`, `bout_type`, `external_source`,
	`match_clock_enabled`, `strip_zone_enabled`
)
SELECT
	`id`,
	json_extract(`payload`, '$.fileName'),
	json_extract(`payload`, '$.videoRelativePath'),
	json_extract(`payload`, '$.videoMimeType'),
	json_extract(`payload`, '$.videoSourceType'),
	json_extract(`payload`, '$.lastModified'),
	json_extract(`payload`, '$.leftFencer'),
	json_extract(`payload`, '$.rightFencer'),
	json_extract(`payload`, '$.boutDate'),
	CASE
		WHEN json_extract(`payload`, '$.boutDate') GLOB '????-??-??'
		THEN json_extract(`payload`, '$.boutDate')
		ELSE NULL
	END,
	json_extract(`payload`, '$.boutType'),
	json_extract(`payload`, '$.externalSource'),
	json_extract(`payload`, '$.taggingOptions.matchClockEnabled'),
	json_extract(`payload`, '$.taggingOptions.stripZoneEnabled')
FROM `sessions_legacy`;
--> statement-breakpoint
INSERT INTO `tags` (
	`bout_id`, `id`, `position`, `timestamp`, `seq`, `created_at`, `side`,
	`action`, `mistake`, `match_period`, `match_clock`, `strip_zone`
)
SELECT
	`session_id`,
	`id`,
	`position`,
	json_extract(`payload`, '$.timestamp'),
	json_extract(`payload`, '$.seq'),
	json_extract(`payload`, '$.createdAt'),
	json_extract(`payload`, '$.side'),
	json_extract(`payload`, '$.action'),
	json_extract(`payload`, '$.mistake'),
	json_extract(`payload`, '$.matchPeriod'),
	json_extract(`payload`, '$.matchClock'),
	json_extract(`payload`, '$.stripZone')
FROM `tags_legacy`
ORDER BY `session_id`, `position`;
--> statement-breakpoint
INSERT INTO `comments` (`tag_row_id`, `body`, `content_hash`)
SELECT
	`t`.`row_id`,
	COALESCE(json_extract(`legacy`.`payload`, '$.comment'), ''),
	''
FROM `tags_legacy` AS `legacy`
INNER JOIN `tags` AS `t`
	ON `t`.`bout_id` = `legacy`.`session_id` AND `t`.`id` = `legacy`.`id`;
--> statement-breakpoint
CREATE TEMP TABLE `relational_migration_guard` (
	`valid` integer NOT NULL CHECK (`valid` = 1)
);
--> statement-breakpoint
INSERT INTO `relational_migration_guard` (`valid`)
SELECT
	(CASE WHEN
		(SELECT count(*) FROM `sessions_legacy`) = (SELECT count(*) FROM `bouts`)
		AND (SELECT count(*) FROM `tags_legacy`) = (SELECT count(*) FROM `tags`)
		AND (SELECT count(*) FROM `tags_legacy`) = (SELECT count(*) FROM `comments`)
	THEN 1 ELSE 0 END);
--> statement-breakpoint
DROP TABLE `relational_migration_guard`;
--> statement-breakpoint
DROP TABLE `tags_legacy`;
--> statement-breakpoint
DROP TABLE `sessions_legacy`;
