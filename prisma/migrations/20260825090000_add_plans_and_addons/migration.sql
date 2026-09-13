-- CreateEnum
CREATE TYPE "Product" AS ENUM ('ALGOSUITE', 'UNITYCOMMERCE');

-- CreateEnum
CREATE TYPE "PriceUnit" AS ENUM ('PER_USER_MONTHLY', 'FLAT_MONTHLY');

-- CreateEnum
CREATE TYPE "AddOnPricingType" AS ENUM ('FLAT_MONTHLY', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIAL', 'CANCELED');

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "product" "Product" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tagline" TEXT,
    "priceUnit" "PriceUnit" NOT NULL DEFAULT 'FLAT_MONTHLY',
    "priceAmount" DOUBLE PRECISION,
    "transactionFeePercent" DOUBLE PRECISION,
    "userLimit" INTEGER,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddOn" (
    "id" TEXT NOT NULL,
    "product" "Product" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "pricingType" "AddOnPricingType" NOT NULL DEFAULT 'FLAT_MONTHLY',
    "priceAmount" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddOn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "storeName" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionAddOn" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionAddOn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_product_slug_key" ON "Plan"("product", "slug");

-- CreateIndex
CREATE INDEX "Plan_product_isActive_idx" ON "Plan"("product", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AddOn_product_slug_key" ON "AddOn"("product", "slug");

-- CreateIndex
CREATE INDEX "AddOn_product_isActive_idx" ON "AddOn"("product", "isActive");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionAddOn_subscriptionId_addOnId_key" ON "SubscriptionAddOn"("subscriptionId", "addOnId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionAddOn" ADD CONSTRAINT "SubscriptionAddOn_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionAddOn" ADD CONSTRAINT "SubscriptionAddOn_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "AddOn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
