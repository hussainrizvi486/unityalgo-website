CREATE TYPE "public"."AddOnPricingType" AS ENUM('FLAT_MONTHLY', 'ONE_TIME');--> statement-breakpoint
CREATE TYPE "public"."BillingStatus" AS ENUM('DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'REFUNDED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."EmailPurpose" AS ENUM('TRANSACTIONAL', 'SUPPORT', 'BILLING', 'MARKETING');--> statement-breakpoint
CREATE TYPE "public"."LeadSource" AS ENUM('CONTACT_FORM', 'IMPORT', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."LeadStatus" AS ENUM('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST');--> statement-breakpoint
CREATE TYPE "public"."PaddleEventStatus" AS ENUM('PENDING', 'PROCESSED', 'IGNORED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."PriceUnit" AS ENUM('PER_USER_MONTHLY', 'FLAT_MONTHLY');--> statement-breakpoint
CREATE TYPE "public"."Role" AS ENUM('ADMIN', 'CUSTOMER');--> statement-breakpoint
CREATE TYPE "public"."SubscriptionStatus" AS ENUM('ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELED');--> statement-breakpoint
CREATE TYPE "public"."TicketStatus" AS ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."VerificationPurpose" AS ENUM('REGISTRATION', 'PASSWORD_RESET');--> statement-breakpoint
CREATE TABLE "contact_list" (
	"id" text PRIMARY KEY NOT NULL,
	"firstName" text NOT NULL,
	"lastName" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"message" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "EmailVerification" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"otp" text NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"verifiedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"purpose" "VerificationPurpose" DEFAULT 'REGISTRATION' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Post" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text NOT NULL,
	"content" text NOT NULL,
	"coverImage" text NOT NULL,
	"tags" text[] DEFAULT '{"RAY"}',
	"published" boolean DEFAULT false NOT NULL,
	"publishedAt" timestamp(3),
	"metaTitle" text,
	"metaDescription" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"bgColor" text,
	"textColor" text
);
--> statement-breakpoint
CREATE TABLE "SupportTicket" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"status" "TicketStatus" DEFAULT 'OPEN' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Comment" (
	"id" text PRIMARY KEY NOT NULL,
	"entityType" text NOT NULL,
	"entityId" text NOT NULL,
	"authorId" text NOT NULL,
	"body" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SubscriptionAddOn" (
	"id" text PRIMARY KEY NOT NULL,
	"subscriptionId" text NOT NULL,
	"addOnId" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "AddOn" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"pricingType" "AddOnPricingType" DEFAULT 'FLAT_MONTHLY' NOT NULL,
	"priceAmount" double precision,
	"isActive" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"productId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"planId" text NOT NULL,
	"status" "SubscriptionStatus" DEFAULT 'ACTIVE' NOT NULL,
	"storeName" text,
	"startedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"currentPeriodEnd" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"productId" text NOT NULL,
	"paddleSubscriptionId" text,
	"paddleCustomerId" text,
	"canceledAt" timestamp(3),
	"cancelAtPeriodEnd" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Address" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"addressLine1" text NOT NULL,
	"addressLine2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"country" text NOT NULL,
	"postcode" text NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Product" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"slug" text NOT NULL,
	"tagline" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"showOnLanding" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"passwordHash" text NOT NULL,
	"name" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"role" "Role" DEFAULT 'ADMIN' NOT NULL,
	"firstName" text,
	"lastName" text,
	"phone" text,
	"emailVerifiedAt" timestamp(3),
	"username" text,
	"company" text,
	"companyEmail" text,
	"jobTitle" text,
	"alternatePhone" text,
	"website" text,
	"taxId" text,
	"industry" text,
	"companySize" text,
	"preferredCurrency" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "BillingRecord" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"subscriptionId" text,
	"tenantId" uuid,
	"invoiceNumber" text NOT NULL,
	"description" text NOT NULL,
	"amount" double precision NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" "BillingStatus" DEFAULT 'DRAFT' NOT NULL,
	"periodStart" timestamp(3),
	"periodEnd" timestamp(3),
	"issuedAt" timestamp(3),
	"dueDate" timestamp(3),
	"paidAt" timestamp(3),
	"paymentMethod" text,
	"paymentReference" text,
	"notes" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"refundedAt" timestamp(3),
	"refundedAmount" double precision
);
--> statement-breakpoint
CREATE TABLE "EmailAccount" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"address" text NOT NULL,
	"fromName" text,
	"purpose" "EmailPurpose" DEFAULT 'TRANSACTIONAL' NOT NULL,
	"smtpHost" text NOT NULL,
	"smtpPort" integer DEFAULT 587 NOT NULL,
	"smtpSecure" boolean DEFAULT false NOT NULL,
	"smtpUsername" text NOT NULL,
	"smtpPasswordCiphertext" text NOT NULL,
	"imapHost" text,
	"imapPort" integer DEFAULT 993,
	"imapSecure" boolean DEFAULT true NOT NULL,
	"imapUsername" text,
	"imapPasswordCiphertext" text,
	"isDefault" boolean DEFAULT false NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"lastTestedAt" timestamp(3),
	"lastTestOk" boolean,
	"lastTestError" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT "EmailAccount_smtpPort_range" CHECK (("smtpPort" >= 1) AND ("smtpPort" <= 65535)),
	CONSTRAINT "EmailAccount_imapPort_range" CHECK (("imapPort" IS NULL) OR (("imapPort" >= 1) AND ("imapPort" <= 65535))),
	CONSTRAINT "EmailAccount_imap_complete" CHECK ((("imapHost" IS NULL) AND ("imapUsername" IS NULL) AND ("imapPasswordCiphertext" IS NULL)) OR (("imapHost" IS NOT NULL) AND ("imapUsername" IS NOT NULL) AND ("imapPasswordCiphertext" IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE "Currency" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"numberFormat" text DEFAULT '#,###.##' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT "Currency_code_format" CHECK (code ~ '^[A-Z]{3,8}$'::text)
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"firstName" text NOT NULL,
	"lastName" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"company" text,
	"message" text NOT NULL,
	"source" "LeadSource" DEFAULT 'CONTACT_FORM' NOT NULL,
	"status" "LeadStatus" DEFAULT 'NEW' NOT NULL,
	"notes" text,
	"userId" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PaddleEvent" (
	"id" text PRIMARY KEY NOT NULL,
	"eventType" text NOT NULL,
	"payload" jsonb NOT NULL,
	"receivedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"status" "PaddleEventStatus" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"processedAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "AppCatalog" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"frappeAppName" text,
	"isInstallable" boolean DEFAULT false NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "LoginSession" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"userAgent" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"lastSeenAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"revokedAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "Notification" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"eventKey" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"href" text,
	"readAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SiteEmailEvent" (
	"id" text PRIMARY KEY NOT NULL,
	"siteId" text NOT NULL,
	"eventKey" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Plan" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"tagline" text,
	"priceUnit" "PriceUnit" DEFAULT 'FLAT_MONTHLY' NOT NULL,
	"priceAmount" double precision,
	"transactionFeePercent" double precision,
	"userLimit" integer,
	"features" text[] DEFAULT '{"RAY"}',
	"isActive" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"productId" text NOT NULL,
	"paddlePriceId" text,
	"currencyId" text,
	"vcpu" double precision,
	"ramMb" integer,
	"storageGb" integer
);
--> statement-breakpoint
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SubscriptionAddOn" ADD CONSTRAINT "SubscriptionAddOn_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."Subscription"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SubscriptionAddOn" ADD CONSTRAINT "SubscriptionAddOn_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "public"."AddOn"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "AddOn" ADD CONSTRAINT "AddOn_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BillingRecord" ADD CONSTRAINT "BillingRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BillingRecord" ADD CONSTRAINT "BillingRecord_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."Subscription"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "LoginSession" ADD CONSTRAINT "LoginSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "public"."Currency"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "contact_list_createdAt_idx" ON "contact_list" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "EmailVerification_email_purpose_idx" ON "EmailVerification" USING btree ("email","purpose");--> statement-breakpoint
CREATE INDEX "Post_published_publishedAt_idx" ON "Post" USING btree ("published","publishedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "Post_slug_key" ON "Post" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket" USING btree ("status");--> statement-breakpoint
CREATE INDEX "SupportTicket_userId_idx" ON "SupportTicket" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Comment_authorId_idx" ON "Comment" USING btree ("authorId");--> statement-breakpoint
CREATE INDEX "Comment_entityType_entityId_idx" ON "Comment" USING btree ("entityType","entityId");--> statement-breakpoint
CREATE INDEX "SubscriptionAddOn_addOnId_idx" ON "SubscriptionAddOn" USING btree ("addOnId");--> statement-breakpoint
CREATE UNIQUE INDEX "SubscriptionAddOn_subscriptionId_addOnId_key" ON "SubscriptionAddOn" USING btree ("subscriptionId","addOnId");--> statement-breakpoint
CREATE INDEX "AddOn_productId_isActive_idx" ON "AddOn" USING btree ("productId","isActive");--> statement-breakpoint
CREATE UNIQUE INDEX "AddOn_productId_slug_key" ON "AddOn" USING btree ("productId","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "Subscription_paddleSubscriptionId_key" ON "Subscription" USING btree ("paddleSubscriptionId");--> statement-breakpoint
CREATE INDEX "Subscription_planId_idx" ON "Subscription" USING btree ("planId");--> statement-breakpoint
CREATE INDEX "Subscription_productId_idx" ON "Subscription" USING btree ("productId");--> statement-breakpoint
CREATE UNIQUE INDEX "Subscription_userId_productId_key" ON "Subscription" USING btree ("userId","productId");--> statement-breakpoint
CREATE INDEX "Address_userId_idx" ON "Address" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Product_isActive_sortOrder_idx" ON "Product" USING btree ("isActive","sortOrder");--> statement-breakpoint
CREATE UNIQUE INDEX "Product_slug_key" ON "Product" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "User_email_key" ON "User" USING btree ("email");--> statement-breakpoint
CREATE INDEX "User_role_idx" ON "User" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "User_username_key" ON "User" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "BillingRecord_invoiceNumber_key" ON "BillingRecord" USING btree ("invoiceNumber");--> statement-breakpoint
CREATE INDEX "BillingRecord_status_idx" ON "BillingRecord" USING btree ("status");--> statement-breakpoint
CREATE INDEX "BillingRecord_subscriptionId_idx" ON "BillingRecord" USING btree ("subscriptionId");--> statement-breakpoint
CREATE INDEX "BillingRecord_tenantId_idx" ON "BillingRecord" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "BillingRecord_userId_idx" ON "BillingRecord" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "EmailAccount_address_key" ON "EmailAccount" USING btree ("address");--> statement-breakpoint
CREATE UNIQUE INDEX "EmailAccount_one_default_idx" ON "EmailAccount" USING btree ("isDefault") WHERE "isDefault";--> statement-breakpoint
CREATE INDEX "EmailAccount_purpose_isActive_idx" ON "EmailAccount" USING btree ("purpose","isActive");--> statement-breakpoint
CREATE UNIQUE INDEX "Currency_code_key" ON "Currency" USING btree ("code");--> statement-breakpoint
CREATE INDEX "Currency_isActive_sortOrder_idx" ON "Currency" USING btree ("isActive","sortOrder");--> statement-breakpoint
CREATE INDEX "leads_email_idx" ON "leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "leads_status_createdAt_idx" ON "leads" USING btree ("status","createdAt");--> statement-breakpoint
CREATE INDEX "leads_userId_idx" ON "leads" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "PaddleEvent_eventType_receivedAt_idx" ON "PaddleEvent" USING btree ("eventType","receivedAt");--> statement-breakpoint
CREATE INDEX "PaddleEvent_status_receivedAt_idx" ON "PaddleEvent" USING btree ("status","receivedAt");--> statement-breakpoint
CREATE INDEX "AppCatalog_isActive_sortOrder_idx" ON "AppCatalog" USING btree ("isActive","sortOrder");--> statement-breakpoint
CREATE UNIQUE INDEX "AppCatalog_slug_key" ON "AppCatalog" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "LoginSession_userId_revokedAt_expiresAt_idx" ON "LoginSession" USING btree ("userId","revokedAt","expiresAt");--> statement-breakpoint
CREATE UNIQUE INDEX "Notification_userId_eventKey_key" ON "Notification" USING btree ("userId","eventKey");--> statement-breakpoint
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification" USING btree ("userId","readAt","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "SiteEmailEvent_siteId_eventKey_key" ON "SiteEmailEvent" USING btree ("siteId","eventKey");--> statement-breakpoint
CREATE INDEX "Plan_currencyId_idx" ON "Plan" USING btree ("currencyId");--> statement-breakpoint
CREATE UNIQUE INDEX "Plan_paddlePriceId_key" ON "Plan" USING btree ("paddlePriceId");--> statement-breakpoint
CREATE INDEX "Plan_productId_isActive_idx" ON "Plan" USING btree ("productId","isActive");--> statement-breakpoint
CREATE UNIQUE INDEX "Plan_productId_slug_key" ON "Plan" USING btree ("productId","slug");
