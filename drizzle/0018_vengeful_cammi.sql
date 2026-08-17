CREATE TABLE `serviceTypeItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`serviceTypeId` int NOT NULL,
	`inventoryItemId` int NOT NULL,
	`defaultQuantity` int NOT NULL DEFAULT 1,
	`isRequired` boolean NOT NULL DEFAULT false,
	`allowEditQuantity` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `serviceTypeItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `service_type_items_owner_service_item_unique` UNIQUE(`ownerId`,`serviceTypeId`,`inventoryItemId`)
);
--> statement-breakpoint
CREATE TABLE `serviceTypes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(160) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`version` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `serviceTypes_id` PRIMARY KEY(`id`),
	CONSTRAINT `service_types_owner_code_unique` UNIQUE(`ownerId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `visitItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`visitId` int NOT NULL,
	`inventoryItemId` int NOT NULL,
	`itemNameSnapshot` varchar(160) NOT NULL,
	`unitSnapshot` varchar(40) NOT NULL,
	`quantity` int NOT NULL,
	`source` enum('default','manual') NOT NULL DEFAULT 'default',
	`clientOperationId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `visitItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `visit_items_owner_operation_unique` UNIQUE(`ownerId`,`clientOperationId`)
);
--> statement-breakpoint
ALTER TABLE `serviceTypeItems` ADD CONSTRAINT `serviceTypeItems_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `serviceTypeItems` ADD CONSTRAINT `serviceTypeItems_serviceTypeId_serviceTypes_id_fk` FOREIGN KEY (`serviceTypeId`) REFERENCES `serviceTypes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `serviceTypeItems` ADD CONSTRAINT `serviceTypeItems_inventoryItemId_inventoryItems_id_fk` FOREIGN KEY (`inventoryItemId`) REFERENCES `inventoryItems`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `serviceTypes` ADD CONSTRAINT `serviceTypes_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `visitItems` ADD CONSTRAINT `visitItems_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `visitItems` ADD CONSTRAINT `visitItems_visitId_visits_id_fk` FOREIGN KEY (`visitId`) REFERENCES `visits`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `visitItems` ADD CONSTRAINT `visitItems_inventoryItemId_inventoryItems_id_fk` FOREIGN KEY (`inventoryItemId`) REFERENCES `inventoryItems`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `service_type_items_service_idx` ON `serviceTypeItems` (`serviceTypeId`);--> statement-breakpoint
CREATE INDEX `visit_items_visit_idx` ON `visitItems` (`visitId`);