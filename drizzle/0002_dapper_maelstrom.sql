CREATE TABLE `bout_participants` (
	`bout_id` text NOT NULL,
	`side` text NOT NULL,
	`fencer_id` text NOT NULL,
	`display_name_snapshot` text NOT NULL,
	FOREIGN KEY (`bout_id`) REFERENCES `bouts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fencer_id`) REFERENCES `fencers`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "bout_participants_side_valid" CHECK("bout_participants"."side" IN ('L', 'R'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bout_participants_bout_side_unique` ON `bout_participants` (`bout_id`,`side`);--> statement-breakpoint
CREATE INDEX `bout_participants_fencer_id_idx` ON `bout_participants` (`fencer_id`);--> statement-breakpoint
CREATE TABLE `fencers` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fencers_normalized_name_unique` ON `fencers` (`normalized_name`);
--> statement-breakpoint
INSERT INTO `fencers` (`id`, `canonical_name`, `normalized_name`, `created_at`, `updated_at`)
SELECT
	'fencer_' || lower(hex(CAST(normalized_name AS BLOB))),
	min(display_name),
	normalized_name,
	min(last_modified),
	max(last_modified)
FROM (
	SELECT trim(`left_fencer`) AS display_name,
		lower(trim(`left_fencer`)) AS normalized_name,
		`last_modified`
	FROM `bouts`
	WHERE `left_fencer` IS NOT NULL AND trim(`left_fencer`) <> ''
	UNION ALL
	SELECT trim(`right_fencer`) AS display_name,
		lower(trim(`right_fencer`)) AS normalized_name,
		`last_modified`
	FROM `bouts`
	WHERE `right_fencer` IS NOT NULL AND trim(`right_fencer`) <> ''
)
GROUP BY normalized_name;
--> statement-breakpoint
INSERT INTO `bout_participants` (`bout_id`, `side`, `fencer_id`, `display_name_snapshot`)
SELECT b.`id`, 'L', f.`id`, b.`left_fencer`
FROM `bouts` b
INNER JOIN `fencers` f ON f.`normalized_name` = lower(trim(b.`left_fencer`))
WHERE b.`left_fencer` IS NOT NULL AND trim(b.`left_fencer`) <> '';
--> statement-breakpoint
INSERT INTO `bout_participants` (`bout_id`, `side`, `fencer_id`, `display_name_snapshot`)
SELECT b.`id`, 'R', f.`id`, b.`right_fencer`
FROM `bouts` b
INNER JOIN `fencers` f ON f.`normalized_name` = lower(trim(b.`right_fencer`))
WHERE b.`right_fencer` IS NOT NULL AND trim(b.`right_fencer`) <> '';
