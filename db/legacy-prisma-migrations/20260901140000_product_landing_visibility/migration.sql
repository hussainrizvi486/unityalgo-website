-- Separate "is this product sellable" from "do we advertise it on the home page".
--
-- `isActive` did both, so taking a product off the landing page also removed it
-- from the customer dashboard's plan picker and from checkout. UnityCommerce is
-- still in development and should not be promoted on the home page yet, but the
-- people already using its page and its checkout must keep working.
--
-- Defaults to true, so every existing product keeps appearing; only the one
-- named below changes.

ALTER TABLE "Product" ADD COLUMN "showOnLanding" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Product" SET "showOnLanding" = false WHERE id = 'unity_commerce';
