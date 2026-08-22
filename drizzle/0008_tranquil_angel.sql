ALTER TABLE `cashTransactions` ADD COLUMN IF NOT EXISTS `sourceInventoryMovementId` int;--> statement-breakpoint
ALTER TABLE `inventoryMovements` ADD COLUMN IF NOT EXISTS `unitCost` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `inventoryMovements` ADD COLUMN IF NOT EXISTS `currency` enum('EGP','SAR') DEFAULT 'EGP' NOT NULL;--> statement-breakpoint
ALTER TABLE `cashTransactions` ADD CONSTRAINT `cash_tx_source_inventory_fk` FOREIGN KEY (`sourceInventoryMovementId`) REFERENCES `inventoryMovements`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `cash_transactions_source_inventory_idx` ON `cashTransactions` (`ownerId`,`sourceInventoryMovementId`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `inventory_movements_purchase_idx` ON `inventoryMovements` (`ownerId`,`movementType`,`movementDate`);