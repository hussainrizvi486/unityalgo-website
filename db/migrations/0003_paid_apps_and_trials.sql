CREATE TABLE "AppPurchase" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"appId" text NOT NULL,
	"siteId" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"priceAmount" double precision NOT NULL,
	"currency" text NOT NULL,
	"billingMode" text NOT NULL,
	"paddleSubscriptionId" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"canceledAt" timestamp (3)
);
--> statement-breakpoint
ALTER TABLE "AppCatalog" ADD COLUMN "priceAmount" double precision;--> statement-breakpoint
ALTER TABLE "AppCatalog" ADD COLUMN "priceCurrency" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "AppCatalog" ADD COLUMN "paddlePriceId" text;--> statement-breakpoint
ALTER TABLE "Plan" ADD COLUMN "trialDays" integer;--> statement-breakpoint
CREATE INDEX "AppPurchase_userId_status_idx" ON "AppPurchase" USING btree ("userId" text_ops,"status" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "AppPurchase_site_app_active_key" ON "AppPurchase" USING btree ("siteId" text_ops,"appId" text_ops) WHERE status = 'ACTIVE';