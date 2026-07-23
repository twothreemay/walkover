CREATE TABLE `project_files` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`storage_key` text,
	`static_path` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`client` text DEFAULT 'Internal' NOT NULL,
	`location` text DEFAULT 'Location not set' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`survey_date` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`owner_email` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_slug_unique` ON `projects` (`slug`);--> statement-breakpoint
CREATE TABLE `share_links` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`token` text NOT NULL,
	`label` text DEFAULT 'Project team' NOT NULL,
	`created_by` text NOT NULL,
	`expires_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_links_token_unique` ON `share_links` (`token`);--> statement-breakpoint
INSERT INTO `projects` (`id`, `slug`, `title`, `client`, `location`, `description`, `survey_date`, `status`, `owner_email`, `created_at`, `updated_at`)
VALUES ('a54-walkover-2026', 'a54-highway-site-walkover', 'A54 Highway Site Walkover', 'Internal highway team', 'A54 corridor', 'Existing-conditions reality capture for remote site review, design observations and survey planning.', '2026-07-23', 'draft', 'workspace-owner', 1784836800000, 1784836800000);--> statement-breakpoint
INSERT INTO `project_files` (`id`, `project_id`, `kind`, `filename`, `content_type`, `size`, `storage_key`, `static_path`, `created_at`)
VALUES ('a54-model-glb', 'a54-walkover-2026', 'model', '23_07_2026.glb', 'model/gltf-binary', 6021484, NULL, '/23_07_2026.glb', 1784836800000);
