ALTER TYPE "public"."SubscriptionStatus" ADD VALUE 'PAUSED';--> statement-breakpoint
CREATE TABLE "BillingOperation" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"subscriptionId" text NOT NULL,
	"planId" text NOT NULL,
	"status" text DEFAULT 'QUOTED' NOT NULL,
	"request" jsonb NOT NULL,
	"preview" jsonb NOT NULL,
	"expectedUpdatedAt" text NOT NULL,
	"expiresAt" timestamp (3) NOT NULL,
	"error" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "BillingOperation_status" CHECK ("BillingOperation"."status" in ('QUOTED', 'PROCESSING', 'UNKNOWN', 'SUCCEEDED', 'FAILED'))
);
--> statement-breakpoint
CREATE TABLE "BillingProviderRecord" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"userId" text,
	"subscriptionId" text,
	"payload" jsonb NOT NULL,
	"providerUpdatedAt" timestamp (3) NOT NULL,
	"syncedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "CreditAccount" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"currency" text NOT NULL,
	"available" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "CreditAccount_nonnegative" CHECK ("CreditAccount"."available" >= 0 and "CreditAccount"."reserved" >= 0),
	CONSTRAINT "CreditAccount_currency" CHECK ("CreditAccount"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "CreditEntry" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"operationKey" text NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"actorId" text NOT NULL,
	"reason" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "CreditEntry_operationKey_unique" UNIQUE("operationKey"),
	CONSTRAINT "CreditEntry_positive" CHECK ("CreditEntry"."amount" > 0),
	CONSTRAINT "CreditEntry_kind" CHECK ("CreditEntry"."kind" in ('GRANT', 'RESERVE', 'CONSUME', 'RELEASE', 'REVERSE'))
);
--> statement-breakpoint
ALTER TABLE "Subscription" ADD COLUMN "paddleUpdatedAt" timestamp (3);--> statement-breakpoint
ALTER TABLE "Subscription" ADD COLUMN "paddleSnapshot" jsonb;--> statement-breakpoint
ALTER TABLE "BillingOperation" ADD CONSTRAINT "BillingOperation_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "BillingOperation" ADD CONSTRAINT "BillingOperation_planId_Plan_id_fk" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "BillingProviderRecord" ADD CONSTRAINT "BillingProviderRecord_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CreditAccount" ADD CONSTRAINT "CreditAccount_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_accountId_CreditAccount_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."CreditAccount"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_actorId_User_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "BillingOperation_pending_subscription" ON "BillingOperation" USING btree ("subscriptionId") WHERE "BillingOperation"."status" in ('PROCESSING', 'UNKNOWN');--> statement-breakpoint
CREATE UNIQUE INDEX "CreditAccount_user_currency" ON "CreditAccount" USING btree ("userId","currency");