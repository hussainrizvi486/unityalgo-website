import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle owns the website's tables (the PascalCase ones Prisma used to own). The controller's
 * snake_case tables belong to Alembic, so they are excluded: a Drizzle migration must never touch them.
 */
export default defineConfig({
    dialect: 'postgresql',
    schema: './db/schema.ts',
    out: './db/migrations',
    dbCredentials: { url: process.env.DATABASE_URL! },
    tablesFilter: ["User", "BillingRecord", "SupportTicket", "Comment", "Address", "EmailVerification", "Lead", "ContactSubmission", "Product", "Currency", "Plan", "AddOn", "Subscription", "PaddleEvent", "SubscriptionAddOn", "EmailAccount", "Post", "AppCatalog", "LoginSession", "Notification", "SiteEmailEvent", "leads", "contact_list"],
});
