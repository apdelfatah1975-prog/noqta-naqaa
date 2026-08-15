ALTER TABLE `visits` ADD `clientOperationId` varchar(64);--> statement-breakpoint
ALTER TABLE `visits` ADD CONSTRAINT `visits_owner_operation_unique` UNIQUE(`ownerId`,`clientOperationId`);