-- Wire subscriptions to Paddle.
--
-- Until now `purchasePlanAction` wrote an ACTIVE subscription straight from a
-- form post, so a plan cost nothing to acquire. Payment moves behind Paddle,
-- and the only thing allowed to grant a subscription is a webhook whose
-- signature has been verified. These columns are what that flow needs:
--
--   Plan.paddlePriceId           which Paddle price sells this plan
--   Subscription.paddle*         the Paddle records behind a subscription
--   SubscriptionStatus.PAST_DUE  a renewal Paddle could not collect
--   PaddleEvent                  every accepted event, for idempotency
--
-- Additive only. Existing plans get a NULL price id, which reads as "not for
-- sale online" and makes checkout refuse rather than guess; existing
-- subscriptions keep their status and simply carry no Paddle identity.

ALTER TABLE "Plan" ADD COLUMN "paddlePriceId" TEXT;

-- One Paddle price sells exactly one plan. Pointing two plans at the same
-- price would make an incoming webhook ambiguous about what was bought.
CREATE UNIQUE INDEX "Plan_paddlePriceId_key" ON "Plan"("paddlePriceId");

ALTER TABLE "Subscription" ADD COLUMN "paddleSubscriptionId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "paddleCustomerId" TEXT;

-- A Paddle subscription belongs to one customer here. Without this a replayed
-- or spoofed event could attach the same paid subscription to a second account.
CREATE UNIQUE INDEX "Subscription_paddleSubscriptionId_key"
    ON "Subscription"("paddleSubscriptionId");

-- Postgres will not let a value added to an enum be used in the same
-- transaction that adds it, and Prisma wraps a migration in one. Recreating
-- the type sidesteps that and keeps this file replayable.
ALTER TYPE "SubscriptionStatus" RENAME TO "SubscriptionStatus_old";

CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELED');

ALTER TABLE "Subscription"
    ALTER COLUMN "status" DROP DEFAULT,
    ALTER COLUMN "status" TYPE "SubscriptionStatus"
        USING ("status"::text::"SubscriptionStatus"),
    ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

DROP TYPE "SubscriptionStatus_old";

CREATE TABLE "PaddleEvent" (
    "id"         TEXT NOT NULL,
    "eventType"  TEXT NOT NULL,
    "payload"    JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaddleEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaddleEvent_eventType_receivedAt_idx"
    ON "PaddleEvent"("eventType", "receivedAt");
