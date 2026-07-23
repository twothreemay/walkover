CREATE TABLE `observations` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `observations` (`id`, `project_id`, `category`, `title`, `description`, `status`, `created_by`, `created_at`, `updated_at`) VALUES
('HW-01', 'a54-walkover-2026', 'Pavement', 'Carriageway surface wear', 'Captured during site walkover', 'review', 'workspace-owner', 1784836800000, 1784836800000);--> statement-breakpoint
INSERT INTO `observations` (`id`, `project_id`, `category`, `title`, `description`, `status`, `created_by`, `created_at`, `updated_at`) VALUES
('HW-02', 'a54-walkover-2026', 'Drainage', 'Gully condition', 'Captured during site walkover', 'open', 'workspace-owner', 1784836801000, 1784836801000);--> statement-breakpoint
INSERT INTO `observations` (`id`, `project_id`, `category`, `title`, `description`, `status`, `created_by`, `created_at`, `updated_at`) VALUES
('HW-03', 'a54-walkover-2026', 'Signs', 'Sign visibility check', 'Captured during site walkover', 'open', 'workspace-owner', 1784836802000, 1784836802000);
