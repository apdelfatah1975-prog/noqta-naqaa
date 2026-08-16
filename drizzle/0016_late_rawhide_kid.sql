ALTER TABLE `inventoryItems` ADD `category` varchar(120) DEFAULT 'عام' NOT NULL;--> statement-breakpoint
ALTER TABLE `inventoryItems` ADD `unit` varchar(40) DEFAULT 'قطعة' NOT NULL;--> statement-breakpoint
ALTER TABLE `inventoryItems` ADD `reorderLevel` int DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `inventoryItems` ADD `defaultUnitCost` int DEFAULT 0 NOT NULL;