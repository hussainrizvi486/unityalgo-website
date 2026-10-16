-- Promote the `Product` enum to a table.
--
-- Plans, add-ons and subscriptions each carried a `product` enum column, so
-- adding a product meant a schema migration and a redeploy. They now hold a
-- `productId` foreign key instead, and the product's label, slug and tagline
-- are editable rows.
--
-- Written additively — create, backfill, verify, then drop — so the 6 plans,
-- 4 add-ons and 2 subscriptions that already exist carry over intact.

-- A table creates a composite type of the same name, so the enum has to
-- vacate "Product" before the table can take it. The columns still reference
-- it under the new name until they are dropped below.
ALTER TYPE "Product" RENAME TO "Product_enum_legacy";

CREATE TABLE "Product" (
    "id"        TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "slug"      TEXT NOT NULL,
    "tagline"   TEXT,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_isActive_sortOrder_idx" ON "Product"("isActive", "sortOrder");

-- The two products that existed as enum members.
INSERT INTO "Product" ("id", "label", "slug", "tagline", "sortOrder", "updatedAt") VALUES
    ('algo_suite',    'AlgoSuite',     'algosuite',     'ERP platform — accounting, HR, inventory and CRM.', 0, CURRENT_TIMESTAMP),
    ('unity_commerce','UnityCommerce', 'unitycommerce', 'Launch and run an online store, built in-house.',   1, CURRENT_TIMESTAMP);

ALTER TABLE "Plan"         ADD COLUMN "productId" TEXT;
ALTER TABLE "AddOn"        ADD COLUMN "productId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "productId" TEXT;

UPDATE "Plan"         SET "productId" = CASE "product"::text WHEN 'ALGOSUITE' THEN 'algo_suite' ELSE 'unity_commerce' END;
UPDATE "AddOn"        SET "productId" = CASE "product"::text WHEN 'ALGOSUITE' THEN 'algo_suite' ELSE 'unity_commerce' END;
UPDATE "Subscription" SET "productId" = CASE "product"::text WHEN 'ALGOSUITE' THEN 'algo_suite' ELSE 'unity_commerce' END;

-- Refuse to continue rather than silently NOT NULL-ing a bad backfill.
DO $$
DECLARE missing INTEGER;
BEGIN
    SELECT (SELECT count(*) FROM "Plan"         WHERE "productId" IS NULL)
         + (SELECT count(*) FROM "AddOn"        WHERE "productId" IS NULL)
         + (SELECT count(*) FROM "Subscription" WHERE "productId" IS NULL)
    INTO missing;
    IF missing > 0 THEN
        RAISE EXCEPTION 'productId backfill left % row(s) unmapped', missing;
    END IF;
END $$;

ALTER TABLE "Plan"         ALTER COLUMN "productId" SET NOT NULL;
ALTER TABLE "AddOn"        ALTER COLUMN "productId" SET NOT NULL;
ALTER TABLE "Subscription" ALTER COLUMN "productId" SET NOT NULL;

-- Prisma's @@unique compiles to a unique index rather than a table
-- constraint, so all five are dropped the same way.
DROP INDEX IF EXISTS "Plan_product_slug_key";
DROP INDEX IF EXISTS "Plan_product_isActive_idx";
DROP INDEX IF EXISTS "AddOn_product_slug_key";
DROP INDEX IF EXISTS "AddOn_product_isActive_idx";
DROP INDEX IF EXISTS "Subscription_userId_product_key";

ALTER TABLE "Plan"  DROP COLUMN "product";
ALTER TABLE "AddOn" DROP COLUMN "product";
ALTER TABLE "Subscription" DROP COLUMN "product";

DROP TYPE "Product_enum_legacy";

CREATE UNIQUE INDEX "Plan_productId_slug_key"  ON "Plan"("productId", "slug");
CREATE INDEX "Plan_productId_isActive_idx"     ON "Plan"("productId", "isActive");
CREATE UNIQUE INDEX "AddOn_productId_slug_key" ON "AddOn"("productId", "slug");
CREATE INDEX "AddOn_productId_isActive_idx"    ON "AddOn"("productId", "isActive");
CREATE UNIQUE INDEX "Subscription_userId_productId_key" ON "Subscription"("userId", "productId");

ALTER TABLE "Plan"         ADD CONSTRAINT "Plan_productId_fkey"         FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AddOn"        ADD CONSTRAINT "AddOn_productId_fkey"        FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
