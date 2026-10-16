ALTER TABLE "Post" ALTER COLUMN "tags" SET DEFAULT ARRAY[]::text[];--> statement-breakpoint
ALTER TABLE "Post" ALTER COLUMN "tags" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "Plan" ALTER COLUMN "features" SET DEFAULT ARRAY[]::text[];--> statement-breakpoint
ALTER TABLE "Plan" ALTER COLUMN "features" SET NOT NULL;