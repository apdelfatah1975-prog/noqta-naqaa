CREATE TABLE `cashTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`transactionType` enum('income','expense') NOT NULL,
	`amount` int NOT NULL,
	`category` varchar(100) NOT NULL,
	`transactionDate` timestamp NOT NULL,
	`recipientName` varchar(160),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cashTransactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cashTransactions` ADD CONSTRAINT `cashTransactions_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cash_transactions_owner_date_idx` ON `cashTransactions` (`ownerId`,`transactionDate`);