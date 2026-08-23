ALTER TABLE `visits` ADD `photoBeforeKey` varchar(512);--> statement-breakpoint
ALTER TABLE `visits` ADD `photoAfterKey` varchar(512);--> statement-breakpoint
ALTER TABLE `workOrderProofs` ADD `photoSlot` enum('before','after','general');