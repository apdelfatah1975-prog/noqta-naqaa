ALTER TABLE `cashTransactions` ADD `clientOperationId` varchar(64);--> statement-breakpoint
ALTER TABLE `inventoryItems` ADD `clientOperationId` varchar(64);--> statement-breakpoint
ALTER TABLE `inventoryMovements` ADD `clientOperationId` varchar(64);--> statement-breakpoint
ALTER TABLE `cashTransactions` ADD CONSTRAINT `cash_transactions_owner_operation_unique` UNIQUE(`ownerId`,`clientOperationId`);--> statement-breakpoint
ALTER TABLE `inventoryItems` ADD CONSTRAINT `inventory_items_owner_operation_unique` UNIQUE(`ownerId`,`clientOperationId`);--> statement-breakpoint
ALTER TABLE `inventoryMovements` ADD CONSTRAINT `inventory_movements_owner_operation_unique` UNIQUE(`ownerId`,`clientOperationId`);