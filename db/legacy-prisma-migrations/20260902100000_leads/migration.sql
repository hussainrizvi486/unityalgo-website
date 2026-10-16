-- Leads: people who asked to be contacted through the public form.
--
-- Existing contact_list rows are copied in rather than left behind, so the
-- admin's lead list is the whole history from day one. contact_list itself is
-- left in place: the /admin/contacts page still reads it, and dropping a table
-- whose data has only just been copied is not something to do in the same
-- migration that copies it.

CREATE TYPE "LeadSource" AS ENUM ('CONTACT_FORM', 'IMPORT', 'MANUAL');
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST');

CREATE TABLE "leads" (
    "id"        TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName"  TEXT NOT NULL,
    "email"     TEXT NOT NULL,
    "phone"     TEXT NOT NULL,
    "company"   TEXT,
    "message"   TEXT NOT NULL,
    "source"    "LeadSource" NOT NULL DEFAULT 'CONTACT_FORM',
    "status"    "LeadStatus" NOT NULL DEFAULT 'NEW',
    "notes"     TEXT,
    "userId"    TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "leads_status_createdAt_idx" ON "leads" ("status", "createdAt");
CREATE INDEX "leads_email_idx"            ON "leads" ("email");
CREATE INDEX "leads_userId_idx"           ON "leads" ("userId");

ALTER TABLE "leads"
    ADD CONSTRAINT "leads_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill. IMPORT rather than CONTACT_FORM so it stays visible which rows
-- predate this table.
INSERT INTO "leads" ("id", "firstName", "lastName", "email", "phone", "message", "source", "status", "createdAt", "updatedAt")
SELECT "id", "firstName", "lastName", "email", "phone", "message", 'IMPORT', 'NEW', "createdAt", "createdAt"
FROM "contact_list";

-- Link any backfilled lead whose email already has an account.
UPDATE "leads" AS l
SET "userId" = u."id"
FROM "User" AS u
WHERE lower(u."email") = lower(l."email") AND l."userId" IS NULL;
