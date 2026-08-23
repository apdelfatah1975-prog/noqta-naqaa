CREATE TABLE `exportHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`exportedBy` int NOT NULL,
	`selectedTables` text NOT NULL,
	`counts` text NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`generatedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exportHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `exportHistory` ADD CONSTRAINT `exportHistory_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `exportHistory` ADD CONSTRAINT `exportHistory_exportedBy_users_id_fk` FOREIGN KEY (`exportedBy`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `export_history_owner_created_idx` ON `exportHistory` (`ownerId`,`createdAt`);