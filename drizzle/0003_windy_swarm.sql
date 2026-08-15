CREATE TABLE `notificationSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`leadDays` int NOT NULL DEFAULT 1,
	`alertHour` int NOT NULL DEFAULT 9,
	`alertMinute` int NOT NULL DEFAULT 0,
	`timezoneOffsetMinutes` int NOT NULL DEFAULT 180,
	`scheduleCronTaskUid` varchar(65),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notificationSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_settings_owner_unique` UNIQUE(`ownerId`)
);
--> statement-breakpoint
ALTER TABLE `reminders` ADD `alertedAt` timestamp;--> statement-breakpoint
ALTER TABLE `notificationSettings` ADD CONSTRAINT `notificationSettings_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `notification_settings_schedule_idx` ON `notificationSettings` (`scheduleCronTaskUid`);