CREATE TABLE "CreditRedemption" (
	"id" text PRIMARY KEY NOT NULL,
	"operationId" text NOT NULL,
	"accountId" text NOT NULL,
	"userId" text NOT NULL,
	"kind" text NOT NULL,
	"currency" text NOT NULL,
	"reservedAmount" integer NOT NULL,
	"consumedAmount" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'RESERVED' NOT NULL,
	"paddleDiscountId" text,
	"paddleTransactionId" text,
	"paddleSubscriptionId" text,
	"cleanupRequired" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "CreditRedemption_operationId_unique" UNIQUE("operationId"),
	CONSTRAINT "CreditRedemption_paddleDiscountId_unique" UNIQUE("paddleDiscountId"),
	CONSTRAINT "CreditRedemption_paddleTransactionId_unique" UNIQUE("paddleTransactionId"),
	CONSTRAINT "CreditRedemption_amounts" CHECK ("CreditRedemption"."reservedAmount" > 0 and "CreditRedemption"."consumedAmount" >= 0 and "CreditRedemption"."consumedAmount" <= "CreditRedemption"."reservedAmount"),
	CONSTRAINT "CreditRedemption_status" CHECK ("CreditRedemption"."status" in ('RESERVED', 'SETTLED', 'RELEASED')),
	CONSTRAINT "CreditRedemption_kind" CHECK ("CreditRedemption"."kind" in ('CHECKOUT', 'UPGRADE', 'RENEWAL'))
);
--> statement-breakpoint
ALTER TABLE "CreditRedemption" ADD CONSTRAINT "CreditRedemption_operationId_BillingOperation_id_fk" FOREIGN KEY ("operationId") REFERENCES "public"."BillingOperation"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CreditRedemption" ADD CONSTRAINT "CreditRedemption_accountId_CreditAccount_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."CreditAccount"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CreditRedemption" ADD CONSTRAINT "CreditRedemption_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "CreditRedemption_user_status" ON "CreditRedemption" USING btree ("userId","status");--> statement-breakpoint
CREATE INDEX "CreditRedemption_subscription" ON "CreditRedemption" USING btree ("paddleSubscriptionId");