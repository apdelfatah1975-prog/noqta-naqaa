ALTER TABLE `visits` ADD `status` enum('assigned','en_route','arrived','in_progress','completed','postponed','cancelled') DEFAULT 'assigned' NOT NULL;--> statement-breakpoint
ALTER TABLE `visits` ADD `assignedTechnicianId` int;--> statement-breakpoint
ALTER TABLE `visits` ADD `arrivedAt` timestamp;--> statement-breakpoint
ALTER TABLE `visits` ADD `completedAt` timestamp;--> statement-breakpoint
ALTER TABLE `visits` ADD CONSTRAINT `visits_assignedTechnicianId_users_id_fk` FOREIGN KEY (`assignedTechnicianId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;