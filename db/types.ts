/**
 * Row and enum types for the website's tables, inferred from the Drizzle schema.
 * They take the place of the types `@prisma/client` used to export.
 */
import type { InferSelectModel } from 'drizzle-orm';
import * as s from './schema';

export type User = InferSelectModel<typeof s.user>;
export type Plan = InferSelectModel<typeof s.plan>;
export type AddOn = InferSelectModel<typeof s.addOn>;
export type Subscription = InferSelectModel<typeof s.subscription>;
export type SubscriptionAddOn = InferSelectModel<typeof s.subscriptionAddOn>;
export type EmailAccount = InferSelectModel<typeof s.emailAccount>;
export type Currency = InferSelectModel<typeof s.currency>;

export type AddOnPricingType = (typeof s.addOnPricingType.enumValues)[number];
export type EmailPurpose = (typeof s.emailPurpose.enumValues)[number];
export type LeadSource = (typeof s.leadSource.enumValues)[number];
export type LeadStatus = (typeof s.leadStatus.enumValues)[number];
export type PriceUnit = (typeof s.priceUnit.enumValues)[number];
export type Role = (typeof s.role.enumValues)[number];
export type SubscriptionStatus = (typeof s.subscriptionStatus.enumValues)[number];
export type TicketStatus = (typeof s.ticketStatus.enumValues)[number];
export type VerificationPurpose = (typeof s.verificationPurpose.enumValues)[number];
