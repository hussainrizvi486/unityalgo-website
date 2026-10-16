# Legacy Prisma migrations

These are the migrations Prisma ran before the website moved to Drizzle ORM. They are kept as history only:
nothing applies them any more.

- The current schema is `db/schema.ts`. Its baseline (`db/migrations/0000_*`) describes the database as it stood
  after the last of these ran.
- Existing databases record that baseline with `npm run db:baseline`; new migrations are written with
  `npm run db:generate` and applied with `npm run db:migrate`.
- The `_prisma_migrations` table that Prisma left in existing databases is harmless and can be dropped.
