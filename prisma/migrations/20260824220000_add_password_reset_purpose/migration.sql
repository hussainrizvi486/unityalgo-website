-- CreateEnum
CREATE TYPE "VerificationPurpose" AS ENUM ('REGISTRATION', 'PASSWORD_RESET');

-- AlterTable
ALTER TABLE "EmailVerification"
  ADD COLUMN "purpose" "VerificationPurpose" NOT NULL DEFAULT 'REGISTRATION';

-- Replace the old single-column index with the composite one the model now declares.
DROP INDEX "EmailVerification_email_idx";
CREATE INDEX "EmailVerification_email_purpose_idx" ON "EmailVerification"("email", "purpose");
