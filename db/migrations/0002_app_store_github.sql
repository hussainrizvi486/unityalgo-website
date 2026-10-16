ALTER TABLE "AppCatalog" ADD COLUMN "source" text DEFAULT 'image' NOT NULL;--> statement-breakpoint
ALTER TABLE "AppCatalog" ADD COLUMN "repoUrl" text;--> statement-breakpoint
ALTER TABLE "AppCatalog" ADD COLUMN "branch" text;--> statement-breakpoint
ALTER TABLE "AppCatalog" ADD COLUMN "defaultBranch" text;--> statement-breakpoint
ALTER TABLE "AppCatalog" ADD COLUMN "branches" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "AppCatalog" ADD COLUMN "publisher" text;--> statement-breakpoint
ALTER TABLE "AppCatalog" ADD COLUMN "latestCommit" text;--> statement-breakpoint
ALTER TABLE "AppCatalog" ADD COLUMN "latestCommitMessage" text;--> statement-breakpoint
ALTER TABLE "AppCatalog" ADD COLUMN "latestCommitAt" timestamp (3);--> statement-breakpoint
ALTER TABLE "AppCatalog" ADD COLUMN "latestVersion" text;--> statement-breakpoint
ALTER TABLE "AppCatalog" ADD COLUMN "frappeRange" text;--> statement-breakpoint
ALTER TABLE "AppCatalog" ADD COLUMN "compatibility" text;--> statement-breakpoint
ALTER TABLE "AppCatalog" ADD COLUMN "compatibilityNote" text;--> statement-breakpoint
ALTER TABLE "AppCatalog" ADD COLUMN "lastCheckedAt" timestamp (3);