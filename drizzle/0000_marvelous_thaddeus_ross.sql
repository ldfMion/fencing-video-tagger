CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	CONSTRAINT "sessions_payload_is_json" CHECK(json_valid("sessions"."payload"))
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`session_id` text NOT NULL,
	`id` text NOT NULL,
	`position` integer NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`session_id`, `id`),
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tags_position_is_nonnegative" CHECK("tags"."position" >= 0),
	CONSTRAINT "tags_payload_is_json" CHECK(json_valid("tags"."payload"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_session_position_unique` ON `tags` (`session_id`,`position`);