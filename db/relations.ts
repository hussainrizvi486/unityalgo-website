import { relations } from "drizzle-orm/relations";
import { user, supportTicket, comment, subscription, subscriptionAddOn, addOn, product, plan, address, billingRecord, lead, loginSession, notification, currency } from "./schema";

export const supportTicketRelations = relations(supportTicket, ({one}) => ({
	user: one(user, {
		fields: [supportTicket.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	supportTickets: many(supportTicket),
	comments: many(comment),
	subscriptions: many(subscription),
	addresses: many(address),
	billingRecords: many(billingRecord),
	leads: many(lead),
	loginSessions: many(loginSession),
	notifications: many(notification),
}));

export const commentRelations = relations(comment, ({one}) => ({
	author: one(user, {
		fields: [comment.authorId],
		references: [user.id]
	}),
}));

export const subscriptionAddOnRelations = relations(subscriptionAddOn, ({one}) => ({
	subscription: one(subscription, {
		fields: [subscriptionAddOn.subscriptionId],
		references: [subscription.id]
	}),
	addOn: one(addOn, {
		fields: [subscriptionAddOn.addOnId],
		references: [addOn.id]
	}),
}));

export const subscriptionRelations = relations(subscription, ({one, many}) => ({
	addOns: many(subscriptionAddOn),
	user: one(user, {
		fields: [subscription.userId],
		references: [user.id]
	}),
	plan: one(plan, {
		fields: [subscription.planId],
		references: [plan.id]
	}),
	product: one(product, {
		fields: [subscription.productId],
		references: [product.id]
	}),
	billingRecords: many(billingRecord),
}));

export const addOnRelations = relations(addOn, ({one, many}) => ({
	subscriptionAddOns: many(subscriptionAddOn),
	product: one(product, {
		fields: [addOn.productId],
		references: [product.id]
	}),
}));

export const productRelations = relations(product, ({many}) => ({
	addOns: many(addOn),
	subscriptions: many(subscription),
	plans: many(plan),
}));

export const planRelations = relations(plan, ({one, many}) => ({
	subscriptions: many(subscription),
	product: one(product, {
		fields: [plan.productId],
		references: [product.id]
	}),
	currency: one(currency, {
		fields: [plan.currencyId],
		references: [currency.id]
	}),
}));

export const addressRelations = relations(address, ({one}) => ({
	user: one(user, {
		fields: [address.userId],
		references: [user.id]
	}),
}));

export const billingRecordRelations = relations(billingRecord, ({one}) => ({
	user: one(user, {
		fields: [billingRecord.userId],
		references: [user.id]
	}),
	subscription: one(subscription, {
		fields: [billingRecord.subscriptionId],
		references: [subscription.id]
	}),
}));

export const leadRelations = relations(lead, ({one}) => ({
	user: one(user, {
		fields: [lead.userId],
		references: [user.id]
	}),
}));

export const loginSessionRelations = relations(loginSession, ({one}) => ({
	user: one(user, {
		fields: [loginSession.userId],
		references: [user.id]
	}),
}));

export const notificationRelations = relations(notification, ({one}) => ({
	user: one(user, {
		fields: [notification.userId],
		references: [user.id]
	}),
}));

export const currencyRelations = relations(currency, ({many}) => ({
	plans: many(plan),
}));