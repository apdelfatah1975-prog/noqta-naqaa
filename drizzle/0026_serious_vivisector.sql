CREATE TABLE `customerReviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerName` varchar(160) NOT NULL,
	`stars` int NOT NULL,
	`comment` text NOT NULL,
	`consentToPublish` boolean NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customerReviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `customerReviews` ADD CONSTRAINT `customerReviews_reviewedBy_users_id_fk` FOREIGN KEY (`reviewedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `customer_reviews_status_created_idx` ON `customerReviews` (`status`,`createdAt`);