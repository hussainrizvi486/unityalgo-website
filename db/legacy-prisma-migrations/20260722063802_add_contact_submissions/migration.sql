-- CreateTable
CREATE TABLE "contact_list" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_list_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_list_createdAt_idx" ON "contact_list"("createdAt");
