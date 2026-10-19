ALTER TABLE "User" ADD COLUMN "tourCompletedAt" timestamp (3);--> statement-breakpoint
UPDATE "User" SET "tourCompletedAt" = now() WHERE "role" = 'CUSTOMER';
