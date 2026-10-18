CREATE TABLE "RateLimit" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"resetAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "EmailVerification" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit" USING btree ("resetAt" timestamp_ops);