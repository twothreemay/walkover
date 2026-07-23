CREATE TABLE `admin_access_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`organisation` text DEFAULT '' NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`reviewed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_access_requests_email_unique` ON `admin_access_requests` (`email`);--> statement-breakpoint
CREATE TABLE `admins` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'admin' NOT NULL,
	`created_at` integer NOT NULL
);--> statement-breakpoint
INSERT INTO `admins` (`email`, `display_name`, `role`, `created_at`)
VALUES ('twothreemay@gmail.com', 'Ross Couper', 'owner', 1784840400000);
