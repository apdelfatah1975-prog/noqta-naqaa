CREATE TABLE `allowedTechnicianAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`displayName` varchar(160) NOT NULL,
	`linkedUserId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `allowedTechnicianAccounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `allowed_technician_owner_email_unique` UNIQUE(`ownerId`,`email`)
);
--> statement-breakpoint
ALTER TABLE `allowedTechnicianAccounts` ADD CONSTRAINT `allowedTechnicianAccounts_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `allowedTechnicianAccounts` ADD CONSTRAINT `allowedTechnicianAccounts_linkedUserId_users_id_fk` FOREIGN KEY (`linkedUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `allowed_technician_linked_user_idx` ON `allowedTechnicianAccounts` (`linkedUserId`);