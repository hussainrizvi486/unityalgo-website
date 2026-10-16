-- BillingRecord.tenantId references the controller's Alembic-owned `tenants`
-- table, whose primary key is a uuid. The column has to match that type for
-- the foreign key (added in the controller's b8c2f5e71a04 migration) to be
-- accepted by Postgres. Safe as a plain type change: the table is new.
ALTER TABLE "BillingRecord"
  ALTER COLUMN "tenantId" TYPE UUID USING "tenantId"::uuid;
