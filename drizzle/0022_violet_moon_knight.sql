CREATE TABLE `workOrderProofs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`visitId` int NOT NULL,
	`uploadedBy` int NOT NULL,
	`kind` enum('photo','signature') NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`url` varchar(1024) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workOrderProofs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `workOrderProofs` ADD CONSTRAINT `workOrderProofs_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workOrderProofs` ADD CONSTRAINT `workOrderProofs_visitId_visits_id_fk` FOREIGN KEY (`visitId`) REFERENCES `visits`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workOrderProofs` ADD CONSTRAINT `workOrderProofs_uploadedBy_users_id_fk` FOREIGN KEY (`uploadedBy`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `work_order_proofs_owner_visit_idx` ON `workOrderProofs` (`ownerId`,`visitId`);--> statement-breakpoint
CREATE INDEX `work_order_proofs_uploaded_by_idx` ON `workOrderProofs` (`uploadedBy`);