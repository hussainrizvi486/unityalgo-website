-- Index the foreign keys that had none.
--
-- Postgres indexes a primary key and a unique constraint automatically, but
-- never a foreign key. An unindexed FK costs twice:
--
--   * a lookup by that column is a sequential scan, and
--   * every DELETE or key UPDATE on the *parent* table sequentially scans the
--     child to enforce the constraint — so deleting one plan reads every
--     subscription, and deleting a user reads every comment.
--
-- Two of these are also queried directly: the admin checks Subscription.planId
-- before retiring a plan, and SubscriptionAddOn.addOnId before retiring an
-- add-on. Both were full scans.
--
-- CONCURRENTLY is deliberately not used: Prisma wraps a migration in a
-- transaction, which that option forbids. These tables are small enough that
-- the brief lock is not worth splitting the migration to avoid.

CREATE INDEX "BillingRecord_subscriptionId_idx" ON "BillingRecord"("subscriptionId");
CREATE INDEX "BillingRecord_tenantId_idx"       ON "BillingRecord"("tenantId");
CREATE INDEX "Comment_authorId_idx"             ON "Comment"("authorId");
CREATE INDEX "Subscription_planId_idx"          ON "Subscription"("planId");
CREATE INDEX "Subscription_productId_idx"       ON "Subscription"("productId");
CREATE INDEX "SubscriptionAddOn_addOnId_idx"    ON "SubscriptionAddOn"("addOnId");
