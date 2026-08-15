ALTER TABLE `customers` ADD `clientOperationId` varchar(64);--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_owner_operation_unique` UNIQUE(`ownerId`,`clientOperationId`);