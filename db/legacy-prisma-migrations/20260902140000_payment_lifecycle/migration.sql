-- Payment lifecycle: durable webhook delivery state, cancellation dates,
-- and refunds recorded against the invoice they reverse.
--
-- Before this, a webhook whose handler threw had its audit row DELETED so
-- Paddle's retry could re-run it. That worked, but it destroyed the only
-- record that the delivery ever arrived. The row now stays and carries its
-- own status, so a payment stuck behind a failing handler is visible instead
-- of invisible.

CREATE TYPE "PaddleEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'IGNORED', 'FAILED');

ALTER TABLE "PaddleEvent"
    ADD COLUMN "status"      "PaddleEventStatus" NOT NULL DEFAULT 'PENDING',
    ADD COLUMN "attempts"    INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "error"       TEXT,
    ADD COLUMN "processedAt" TIMESTAMP(3);

-- Every row that already exists got there by being handled successfully:
-- the old code deleted the row on failure, so a surviving row is a success.
UPDATE "PaddleEvent" SET "status" = 'PROCESSED', "processedAt" = "receivedAt";

CREATE INDEX "PaddleEvent_status_receivedAt_idx" ON "PaddleEvent" ("status", "receivedAt");

ALTER TABLE "Subscription"
    ADD COLUMN "canceledAt"        TIMESTAMP(3),
    ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: an already-cancelled subscription has a cancellation date, and
-- updatedAt is the closest thing on record to when it happened.
UPDATE "Subscription" SET "canceledAt" = "updatedAt" WHERE "status" = 'CANCELED';

ALTER TABLE "BillingRecord"
    ADD COLUMN "refundedAt"     TIMESTAMP(3),
    ADD COLUMN "refundedAmount" DOUBLE PRECISION;
