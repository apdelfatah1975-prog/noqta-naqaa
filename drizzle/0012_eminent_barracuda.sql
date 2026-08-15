ALTER TABLE `customers` ADD `manualCode` varchar(64);--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_owner_manual_code_unique` UNIQUE(`ownerId`,`manualCode`);