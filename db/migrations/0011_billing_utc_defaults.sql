ALTER TABLE "BillingFulfillment" ALTER COLUMN "createdAt" SET DEFAULT timezone('UTC', now());--> statement-breakpoint
ALTER TABLE "BillingOperation" ALTER COLUMN "createdAt" SET DEFAULT timezone('UTC', now());--> statement-breakpoint
ALTER TABLE "BillingOperation" ALTER COLUMN "updatedAt" SET DEFAULT timezone('UTC', now());--> statement-breakpoint
ALTER TABLE "BillingProviderRecord" ALTER COLUMN "syncedAt" SET DEFAULT timezone('UTC', now());--> statement-breakpoint
ALTER TABLE "CreditEntry" ALTER COLUMN "createdAt" SET DEFAULT timezone('UTC', now());--> statement-breakpoint
ALTER TABLE "CreditRedemption" ALTER COLUMN "createdAt" SET DEFAULT timezone('UTC', now());--> statement-breakpoint
ALTER TABLE "CreditRedemption" ALTER COLUMN "updatedAt" SET DEFAULT timezone('UTC', now());