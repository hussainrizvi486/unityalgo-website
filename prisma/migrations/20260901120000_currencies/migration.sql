-- Currencies, and the currency a plan is priced in.
--
-- A table rather than an enum so an admin can add one without a migration.
-- `numberFormat` is a grouping pattern rather than a locale name because the
-- South Asian lakh/crore grouping ("#,##,###.##") is a real requirement here
-- and not every grouping has a locale that produces it.
--
-- Plan.currencyId is nullable and ON DELETE SET NULL: retiring a currency must
-- not delete the plans priced in it. Existing plans get NULL and fall back to
-- USD on display, which is what Paddle already charges in.

CREATE TABLE "Currency" (
    "id"           TEXT NOT NULL,
    "code"         TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "symbol"       TEXT NOT NULL,
    "numberFormat" TEXT NOT NULL DEFAULT '#,###.##',
    "isActive"     BOOLEAN NOT NULL DEFAULT true,
    "sortOrder"    INTEGER NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Currency_code_key" ON "Currency"("code");
CREATE INDEX "Currency_isActive_sortOrder_idx" ON "Currency"("isActive", "sortOrder");

-- A code is a short alphabetic identifier; anything else is a typo that would
-- otherwise reach an invoice.
ALTER TABLE "Currency"
    ADD CONSTRAINT "Currency_code_format" CHECK ("code" ~ '^[A-Z]{3,8}$');

ALTER TABLE "Plan" ADD COLUMN "currencyId" TEXT;

CREATE INDEX "Plan_currencyId_idx" ON "Plan"("currencyId");

ALTER TABLE "Plan"
    ADD CONSTRAINT "Plan_currencyId_fkey"
    FOREIGN KEY ("currencyId") REFERENCES "Currency"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Two to start with: USD because every existing price and every Paddle price
-- is already denominated in it, and PKR because that is the first market.
-- Both are ordinary rows an admin can rename, reformat or disable.
INSERT INTO "Currency" ("id", "code", "name", "symbol", "numberFormat", "sortOrder", "updatedAt")
VALUES
    ('cur_usd_seed', 'USD', 'US Dollar',      '$',   '#,###.##',    0, CURRENT_TIMESTAMP),
    ('cur_pkr_seed', 'PKR', 'Pakistani Rupee', 'Rs', '#,##,###.##', 1, CURRENT_TIMESTAMP);

-- Existing plans are priced in USD today, so point them at it rather than
-- leaving every row to fall through to a hard-coded default.
UPDATE "Plan" SET "currencyId" = 'cur_usd_seed' WHERE "currencyId" IS NULL;
