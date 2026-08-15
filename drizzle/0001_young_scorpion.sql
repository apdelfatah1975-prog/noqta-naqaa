CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`address` text,
	`latitude` varchar(32),
	`longitude` varchar(32),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventoryItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`openingQuantity` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventoryMovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inventoryItemId` int NOT NULL,
	`ownerId` int NOT NULL,
	`movementType` enum('incoming','outgoing') NOT NULL,
	`quantity` int NOT NULL,
	`movementDate` timestamp NOT NULL,
	`technicianName` varchar(160),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventoryMovements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`visitId` int NOT NULL,
	`ownerId` int NOT NULL,
	`reminderDate` timestamp NOT NULL,
	`status` enum('pending','completed','dismissed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reminders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `visits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`ownerId` int NOT NULL,
	`visitType` enum('installation','maintenance','cartridge_change','follow_up','other') NOT NULL,
	`visitDate` timestamp NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `visits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventoryItems` ADD CONSTRAINT `inventoryItems_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventoryMovements` ADD CONSTRAINT `inventoryMovements_inventoryItemId_inventoryItems_id_fk` FOREIGN KEY (`inventoryItemId`) REFERENCES `inventoryItems`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventoryMovements` ADD CONSTRAINT `inventoryMovements_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reminders` ADD CONSTRAINT `reminders_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reminders` ADD CONSTRAINT `reminders_visitId_visits_id_fk` FOREIGN KEY (`visitId`) REFERENCES `visits`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reminders` ADD CONSTRAINT `reminders_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `visits` ADD CONSTRAINT `visits_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `visits` ADD CONSTRAINT `visits_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `customers_owner_idx` ON `customers` (`ownerId`);--> statement-breakpoint
CREATE INDEX `customers_phone_idx` ON `customers` (`phone`);--> statement-breakpoint
CREATE INDEX `inventory_items_owner_idx` ON `inventoryItems` (`ownerId`);--> statement-breakpoint
CREATE INDEX `inventory_movements_item_idx` ON `inventoryMovements` (`inventoryItemId`);--> statement-breakpoint
CREATE INDEX `inventory_movements_owner_date_idx` ON `inventoryMovements` (`ownerId`,`movementDate`);--> statement-breakpoint
CREATE INDEX `reminders_owner_status_date_idx` ON `reminders` (`ownerId`,`status`,`reminderDate`);--> statement-breakpoint
CREATE INDEX `reminders_customer_idx` ON `reminders` (`customerId`);--> statement-breakpoint
CREATE INDEX `visits_owner_date_idx` ON `visits` (`ownerId`,`visitDate`);--> statement-breakpoint
CREATE INDEX `visits_customer_idx` ON `visits` (`customerId`);