-- AlterTable: add the column nullable first so existing rows aren't rejected,
-- backfill it from the linked plan, then tighten to NOT NULL.
ALTER TABLE "Subscription" ADD COLUMN "product" "Product";

UPDATE "Subscription" s
SET "product" = p."product"
FROM "Plan" p
WHERE p.id = s."planId";

ALTER TABLE "Subscription" ALTER COLUMN "product" SET NOT NULL;

-- DropIndex
DROP INDEX "Subscription_userId_idx";

-- CreateIndex: one subscription per user per product.
CREATE UNIQUE INDEX "Subscription_userId_product_key" ON "Subscription"("userId", "product");
