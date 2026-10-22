CREATE TABLE "SiteOrder" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"requestKey" text NOT NULL,
	"planId" text NOT NULL,
	"priceId" text,
	"summary" jsonb NOT NULL,
	"encryptedSetup" text,
	"trialDays" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"paddleTransactionId" text,
	"paidAt" timestamp (3),
	"siteId" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"nextAttemptAt" timestamp (3),
	"error" text,
	"createdAt" timestamp (3) DEFAULT timezone('UTC', now()) NOT NULL,
	"updatedAt" timestamp (3) DEFAULT timezone('UTC', now()) NOT NULL,
	CONSTRAINT "SiteOrder_paddleTransactionId_unique" UNIQUE("paddleTransactionId"),
	CONSTRAINT "SiteOrder_status" CHECK ("SiteOrder"."status" in ('DRAFT', 'AWAITING_PAYMENT', 'READY', 'PROVISIONED'))
);
--> statement-breakpoint
ALTER TABLE "SiteOrder" ADD CONSTRAINT "SiteOrder_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SiteOrder" ADD CONSTRAINT "SiteOrder_planId_Plan_id_fk" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "SiteOrder_user_request" ON "SiteOrder" USING btree ("userId","requestKey");--> statement-breakpoint
CREATE INDEX "SiteOrder_status_retry" ON "SiteOrder" USING btree ("status","nextAttemptAt");