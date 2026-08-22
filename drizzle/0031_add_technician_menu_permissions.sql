ALTER TABLE `allowedTechnicianAccounts` ADD COLUMN IF NOT EXISTS `menuPermissions` varchar(255) NOT NULL DEFAULT '["workOrders"]';
