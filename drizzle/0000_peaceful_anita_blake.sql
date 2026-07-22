CREATE TABLE `prediction_records` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`status` text NOT NULL,
	`league_id` text NOT NULL,
	`game_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `prediction_records_device_created_idx` ON `prediction_records` (`device_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `prediction_records_status_idx` ON `prediction_records` (`status`);