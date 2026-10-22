CREATE TABLE "BillingFulfillment" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"planId" text NOT NULL,
	"subscriptionId" text NOT NULL,
	"processedAt" timestamp (3),
	"attempts" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "BillingFulfillment" ADD CONSTRAINT "BillingFulfillment_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "BillingFulfillment" ADD CONSTRAINT "BillingFulfillment_planId_Plan_id_fk" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE restrict ON UPDATE no action;