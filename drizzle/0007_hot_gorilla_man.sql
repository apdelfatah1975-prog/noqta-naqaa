ALTER TABLE `cashTransactions` ADD `sourceVisitId` int;--> statement-breakpoint
ALTER TABLE `cashTransactions` ADD CONSTRAINT `cashTransactions_sourceVisitId_visits_id_fk` FOREIGN KEY (`sourceVisitId`) REFERENCES `visits`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cash_transactions_source_visit_idx` ON `cashTransactions` (`ownerId`,`sourceVisitId`);