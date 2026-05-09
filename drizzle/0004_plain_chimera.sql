PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_api_key` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`key` text NOT NULL,
	`prefix` text,
	`user_id` text NOT NULL,
	`organization_id` text,
	`expires_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`enabled` integer DEFAULT true,
	`permissions` text,
	`metadata` text,
	`rate_limit_enabled` integer DEFAULT false,
	`rate_limit_limit` integer DEFAULT 100 NOT NULL,
	`rate_limit_window` integer DEFAULT 60 NOT NULL,
	`remaining` integer,
	`refill_interval` integer,
	`refill_amount` integer,
	`last_refill_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_api_key`("id", "name", "key", "prefix", "user_id", "organization_id", "expires_at", "created_at", "updated_at", "enabled", "permissions", "metadata", "rate_limit_enabled", "rate_limit_limit", "rate_limit_window", "remaining", "refill_interval", "refill_amount", "last_refill_at") SELECT "id", "name", "key", "prefix", "user_id", "organization_id", "expires_at", "created_at", "updated_at", "enabled", "permissions", "metadata", "rate_limit_enabled", "rate_limit_limit", "rate_limit_window", "remaining", "refill_interval", "refill_amount", "last_refill_at" FROM `api_key`;--> statement-breakpoint
DROP TABLE `api_key`;--> statement-breakpoint
ALTER TABLE `__new_api_key` RENAME TO `api_key`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `api_key_key_unique` ON `api_key` (`key`);