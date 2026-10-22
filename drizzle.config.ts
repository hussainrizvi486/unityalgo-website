import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    dialect: 'postgresql',
    schema: './db/schema.ts',
    out: './db/migrations',
    dbCredentials: { url: process.env.DATABASE_URL! },
    tablesFilter: ["SiteOrder", "CreditRedemption", "BillingFulfillment", "BillingProviderRecord", "BillingOperation", "CreditAccount", "CreditEntry", "User", "BillingRecord", "SupportTicket", "Comment", "Address", "EmailVerification", "Lead", "ContactSubmission", "Product", "Currency", "Plan", "AddOn", "Subscription", "PaddleEvent", "SubscriptionAddOn", "EmailAccount", "Post", "AppCatalog", "AppPurchase", "LoginSession", "Notification", "SiteEmailEvent", "leads", "contact_list"],
});
