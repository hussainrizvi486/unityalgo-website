CREATE TABLE "AppCatalog" (
 "id" TEXT NOT NULL, "slug" TEXT NOT NULL, "name" TEXT NOT NULL,
 "description" TEXT NOT NULL, "category" TEXT NOT NULL, "frappeAppName" TEXT,
 "isInstallable" BOOLEAN NOT NULL DEFAULT false, "isActive" BOOLEAN NOT NULL DEFAULT true,
 "sortOrder" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AppCatalog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AppCatalog_slug_key" ON "AppCatalog"("slug");
CREATE INDEX "AppCatalog_isActive_sortOrder_idx" ON "AppCatalog"("isActive", "sortOrder");
INSERT INTO "AppCatalog" ("id","slug","name","description","category","frappeAppName","isInstallable","sortOrder","updatedAt") VALUES
 ('app_lending','lending','Lending','Manage lending operations, loan applications, repayment schedules, and borrower records. Requires a Frappe image containing the Lending app.','Finance','lending',false,1,CURRENT_TIMESTAMP),
 ('app_fbr','fbr-integration','FBR Integration','Connect invoicing workflows with Pakistan FBR. An approved integration package and your FBR configuration are required.','Compliance',NULL,false,2,CURRENT_TIMESTAMP),
 ('app_pos','point-of-sale','Point of Sale','Run retail sales, record payments, and keep stock connected with ERPNext Point of Sale.','Retail','erpnext',true,3,CURRENT_TIMESTAMP);
CREATE TABLE "LoginSession" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "userAgent" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3), CONSTRAINT "LoginSession_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "LoginSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "LoginSession_userId_revokedAt_expiresAt_idx" ON "LoginSession"("userId","revokedAt","expiresAt");
CREATE TABLE "Notification" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "eventKey" TEXT NOT NULL, "title" TEXT NOT NULL,
 "body" TEXT NOT NULL, "href" TEXT, "readAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Notification_userId_eventKey_key" ON "Notification"("userId","eventKey");
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId","readAt","createdAt");
