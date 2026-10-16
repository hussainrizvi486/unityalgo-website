-- Mail accounts, editable by an admin instead of baked into the environment.
--
-- SMTP settings lived only in SMTP_* environment variables, which meant one
-- mailbox for the whole platform and a redeploy to change it. Accounts are rows
-- now, so support, billing and transactional mail can come from different
-- addresses. The env configuration still works and is the fallback when no
-- account matches, so this is additive: nothing breaks if the table is empty.
--
-- Passwords are AES-256-GCM ciphertext produced by lib/secret-box.ts, keyed by
-- CREDENTIAL_ENCRYPTION_KEY, which lives outside the database. The column names
-- say `Ciphertext` so a plaintext write is obvious in review.

CREATE TYPE "EmailPurpose" AS ENUM ('TRANSACTIONAL', 'SUPPORT', 'BILLING', 'MARKETING');

CREATE TABLE "EmailAccount" (
    "id"       TEXT NOT NULL,
    "label"    TEXT NOT NULL,
    "address"  TEXT NOT NULL,
    "fromName" TEXT,
    "purpose"  "EmailPurpose" NOT NULL DEFAULT 'TRANSACTIONAL',

    -- Outgoing. Required: an account that cannot send is not useful.
    "smtpHost"               TEXT NOT NULL,
    "smtpPort"               INTEGER NOT NULL DEFAULT 587,
    "smtpSecure"             BOOLEAN NOT NULL DEFAULT false,
    "smtpUsername"           TEXT NOT NULL,
    "smtpPasswordCiphertext" TEXT NOT NULL,

    -- Incoming. Optional, and a different protocol: SMTP cannot receive mail,
    -- so a send-only mailbox leaves these null.
    "imapHost"               TEXT,
    "imapPort"               INTEGER DEFAULT 993,
    "imapSecure"             BOOLEAN NOT NULL DEFAULT true,
    "imapUsername"           TEXT,
    "imapPasswordCiphertext" TEXT,

    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,

    "lastTestedAt"  TIMESTAMP(3),
    "lastTestOk"    BOOLEAN,
    "lastTestError" TEXT,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailAccount_pkey" PRIMARY KEY ("id")
);

-- One row per mailbox: two accounts for the same address would make routing
-- ambiguous and could send the same mail twice.
CREATE UNIQUE INDEX "EmailAccount_address_key" ON "EmailAccount"("address");

-- Routing reads by purpose among active accounts.
CREATE INDEX "EmailAccount_purpose_isActive_idx" ON "EmailAccount"("purpose", "isActive");

-- At most one default, enforced by the database rather than by application
-- code that has to remember to clear the previous one.
CREATE UNIQUE INDEX "EmailAccount_one_default_idx"
    ON "EmailAccount"(("isDefault")) WHERE "isDefault";

-- A port is a 16-bit number; anything else is a typo that would fail at dial
-- time with a confusing error.
ALTER TABLE "EmailAccount"
    ADD CONSTRAINT "EmailAccount_smtpPort_range" CHECK ("smtpPort" BETWEEN 1 AND 65535),
    ADD CONSTRAINT "EmailAccount_imapPort_range" CHECK ("imapPort" IS NULL OR "imapPort" BETWEEN 1 AND 65535);

-- Incoming is all-or-nothing: a host without credentials cannot connect, and
-- credentials without a host have nothing to connect to.
ALTER TABLE "EmailAccount"
    ADD CONSTRAINT "EmailAccount_imap_complete" CHECK (
        ("imapHost" IS NULL AND "imapUsername" IS NULL AND "imapPasswordCiphertext" IS NULL)
        OR ("imapHost" IS NOT NULL AND "imapUsername" IS NOT NULL AND "imapPasswordCiphertext" IS NOT NULL)
    );
