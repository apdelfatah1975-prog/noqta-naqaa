CREATE TABLE `technicianLocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`technicianId` int NOT NULL,
	`latitude` varchar(32) NOT NULL,
	`longitude` varchar(32) NOT NULL,
	`accuracy` int,
	`recordedAt` timestamp NOT NULL,
	`sharingUntil` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `technicianLocations_id` PRIMARY KEY(`id`),
	CONSTRAINT `technician_locations_owner_technician_unique` UNIQUE(`ownerId`,`technicianId`)
);
--> statement-breakpoint
ALTER TABLE `technicianLocations` ADD CONSTRAINT `technicianLocations_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `technicianLocations` ADD CONSTRAINT `technicianLocations_technicianId_users_id_fk` FOREIGN KEY (`technicianId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `technician_locations_owner_updated_idx` ON `technicianLocations` (`ownerId`,`updatedAt`);