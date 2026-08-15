ALTER TABLE `cashTransactions` ADD `sourceInventoryMovementId` int;--> statement-breakpoint
ALTER TABLE `inventoryMovements` ADD `unitCost` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `inventoryMovements` ADD `currency` enum('EGP','SAR') DEFAULT 'EGP' NOT NULL;--> statement-breakpoint
ALTER TABLE `cashTransactions` ADD CONSTRAINT `cashTransactions_sourceInventoryMovementId_inventoryMovements_id_fk` FOREIGN KEY (`sourceInventoryMovementId`) REFERENCES `inventoryMovements`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cash_transactions_source_inventory_idx` ON `cashTransactions` (`ownerId`,`sourceInventoryMovementId`);--> statement-breakpoint
CREATE INDEX `inventory_movements_purchase_idx` ON `inventoryMovements` (`ownerId`,`movementType`,`movementDate`);