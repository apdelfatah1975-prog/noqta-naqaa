ALTER TABLE `visits` ADD `salesAgentName` varchar(160);--> statement-breakpoint
ALTER TABLE `visits` ADD `filterCount` int DEFAULT 1 NOT NULL;