ALTER TABLE "SiteOrder" DROP CONSTRAINT "SiteOrder_status";--> statement-breakpoint
DROP INDEX "Subscription_userId_productId_key";--> statement-breakpoint
ALTER TABLE "Subscription" ADD COLUMN "siteOrderId" text;--> statement-breakpoint
ALTER TABLE "Subscription" ADD COLUMN "siteId" text;--> statement-breakpoint
ALTER TABLE "Subscription" ADD COLUMN "appliedPlanId" text;--> statement-breakpoint
ALTER TABLE "Subscription" ADD COLUMN "appliedAt" timestamp (3);--> statement-breakpoint
ALTER TABLE "Subscription" ADD COLUMN "billingSuspended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "Subscription" ADD COLUMN "graceEndsAt" timestamp (3);--> statement-breakpoint
CREATE UNIQUE INDEX "Subscription_siteOrderId_key" ON "Subscription" USING btree ("siteOrderId");--> statement-breakpoint
CREATE UNIQUE INDEX "Subscription_siteId_key" ON "Subscription" USING btree ("siteId");--> statement-breakpoint
CREATE UNIQUE INDEX "Subscription_userId_productId_key" ON "Subscription" USING btree ("userId" text_ops,"productId" text_ops) WHERE "Subscription"."siteOrderId" is null;--> statement-breakpoint
ALTER TABLE "SiteOrder" ADD CONSTRAINT "SiteOrder_status" CHECK ("SiteOrder"."status" in ('DRAFT', 'AWAITING_PAYMENT', 'READY', 'PROVISIONED', 'CANCELED', 'EXPIRED'));
--> statement-breakpoint
-- Backfill only unambiguous, provider-owned site purchases. Never guess which site a legacy entitlement belongs to.
UPDATE "Subscription" s SET "siteOrderId" = o.id, "siteId" = o."siteId", "appliedPlanId" = o."planId", "appliedAt" = o."paidAt"
FROM "SiteOrder" o JOIN "BillingProviderRecord" r ON r.id = o."paddleTransactionId"
WHERE s."siteOrderId" IS NULL AND s."siteId" IS NULL AND s."userId" = o."userId"
AND s."paddleSubscriptionId" = coalesce(r."subscriptionId", r.payload->>'subscription_id')
AND o.status = 'PROVISIONED' AND o."paidAt" IS NOT NULL AND o."siteId" IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM "SiteOrder" other_order JOIN "BillingProviderRecord" other_record ON other_record.id = other_order."paddleTransactionId"
    WHERE other_order.id <> o.id AND coalesce(other_record."subscriptionId", other_record.payload->>'subscription_id') = s."paddleSubscriptionId");
