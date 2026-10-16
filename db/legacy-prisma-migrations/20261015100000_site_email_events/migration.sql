-- CreateTable
CREATE TABLE "SiteEmailEvent" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteEmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteEmailEvent_siteId_eventKey_key" ON "SiteEmailEvent"("siteId", "eventKey");
