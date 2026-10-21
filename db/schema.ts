import { pgTable, index, text, timestamp, uniqueIndex, boolean, foreignKey, doublePrecision, integer, uuid, check, jsonb, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createId } from "@paralleldrive/cuid2"
import { randomUUID } from "node:crypto"

export const addOnPricingType = pgEnum("AddOnPricingType", ['FLAT_MONTHLY', 'ONE_TIME'])
export const billingStatus = pgEnum("BillingStatus", ['DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'REFUNDED', 'CANCELLED'])
export const emailPurpose = pgEnum("EmailPurpose", ['TRANSACTIONAL', 'SUPPORT', 'BILLING', 'MARKETING'])
export const leadSource = pgEnum("LeadSource", ['CONTACT_FORM', 'IMPORT', 'MANUAL'])
export const leadStatus = pgEnum("LeadStatus", ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'])
export const paddleEventStatus = pgEnum("PaddleEventStatus", ['PENDING', 'PROCESSED', 'IGNORED', 'FAILED'])
export const priceUnit = pgEnum("PriceUnit", ['PER_USER_MONTHLY', 'FLAT_MONTHLY'])
export const role = pgEnum("Role", ['ADMIN', 'CUSTOMER'])
export const subscriptionStatus = pgEnum("SubscriptionStatus", ['ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELED'])
export const ticketStatus = pgEnum("TicketStatus", ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
export const verificationPurpose = pgEnum("VerificationPurpose", ['REGISTRATION', 'PASSWORD_RESET'])

export const contactSubmission = pgTable("contact_list", {
	id: text().primaryKey().notNull().$defaultFn(() => createId()),
	firstName: text().notNull(),
	lastName: text().notNull(),
	email: text().notNull(),
	phone: text().notNull(),
	message: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("contact_list_createdAt_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
]);

export const emailVerification = pgTable("EmailVerification", {
	id: text().primaryKey().notNull().$defaultFn(() => createId()),
	email: text().notNull(),
	otp: text().notNull(),
	expiresAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
	verifiedAt: timestamp({ precision: 3, mode: 'date' }),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	purpose: verificationPurpose().default('REGISTRATION').notNull(),
	attempts: integer().default(0).notNull(),
}, (table) => [
	index("EmailVerification_email_purpose_idx").using("btree", table.email.asc().nullsLast().op("text_ops"), table.purpose.asc().nullsLast().op("text_ops")),
]);

export const rateLimit = pgTable("RateLimit", {
	key: text().primaryKey().notNull(),
	count: integer().default(0).notNull(),
	resetAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
}, (table) => [
	index("RateLimit_resetAt_idx").using("btree", table.resetAt.asc().nullsLast().op("timestamp_ops")),
]);

export const post = pgTable("Post", {
	id: text().primaryKey().notNull().$defaultFn(() => createId()),
	slug: text().notNull(),
	title: text().notNull(),
	excerpt: text().notNull(),
	content: text().notNull(),
	coverImage: text().notNull(),
	tags: text().array().notNull().default(sql`ARRAY[]::text[]`),
	published: boolean().default(false).notNull(),
	publishedAt: timestamp({ precision: 3, mode: 'date' }),
	metaTitle: text(),
	metaDescription: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
	bgColor: text(),
	textColor: text(),
}, (table) => [
	index("Post_published_publishedAt_idx").using("btree", table.published.asc().nullsLast().op("timestamp_ops"), table.publishedAt.asc().nullsLast().op("timestamp_ops")),
	uniqueIndex("Post_slug_key").using("btree", table.slug.asc().nullsLast().op("text_ops")),
]);

export const supportTicket = pgTable("SupportTicket", {
	id: text().primaryKey().notNull().$defaultFn(() => createId()),
	userId: text().notNull(),
	subject: text().notNull(),
	description: text().notNull(),
	status: ticketStatus().default('OPEN').notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
	index("SupportTicket_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("SupportTicket_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "SupportTicket_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const comment = pgTable("Comment", {
	id: text().primaryKey().notNull().$defaultFn(() => createId()),
	entityType: text().notNull(),
	entityId: text().notNull(),
	authorId: text().notNull(),
	body: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("Comment_authorId_idx").using("btree", table.authorId.asc().nullsLast().op("text_ops")),
	index("Comment_entityType_entityId_idx").using("btree", table.entityType.asc().nullsLast().op("text_ops"), table.entityId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [user.id],
			name: "Comment_authorId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const subscriptionAddOn = pgTable("SubscriptionAddOn", {
	id: text().primaryKey().notNull().$defaultFn(() => createId()),
	subscriptionId: text().notNull(),
	addOnId: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("SubscriptionAddOn_addOnId_idx").using("btree", table.addOnId.asc().nullsLast().op("text_ops")),
	uniqueIndex("SubscriptionAddOn_subscriptionId_addOnId_key").using("btree", table.subscriptionId.asc().nullsLast().op("text_ops"), table.addOnId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [subscription.id],
			name: "SubscriptionAddOn_subscriptionId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.addOnId],
			foreignColumns: [addOn.id],
			name: "SubscriptionAddOn_addOnId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const addOn = pgTable("AddOn", {
	id: text().primaryKey().notNull().$defaultFn(() => createId()),
	name: text().notNull(),
	slug: text().notNull(),
	description: text(),
	pricingType: addOnPricingType().default('FLAT_MONTHLY').notNull(),
	priceAmount: doublePrecision(),
	isActive: boolean().default(true).notNull(),
	sortOrder: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
	productId: text().notNull(),
}, (table) => [
	index("AddOn_productId_isActive_idx").using("btree", table.productId.asc().nullsLast().op("text_ops"), table.isActive.asc().nullsLast().op("text_ops")),
	uniqueIndex("AddOn_productId_slug_key").using("btree", table.productId.asc().nullsLast().op("text_ops"), table.slug.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [product.id],
			name: "AddOn_productId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const subscription = pgTable("Subscription", {
	id: text().primaryKey().notNull().$defaultFn(() => createId()),
	userId: text().notNull(),
	planId: text().notNull(),
	status: subscriptionStatus().default('ACTIVE').notNull(),
	storeName: text(),
	startedAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	currentPeriodEnd: timestamp({ precision: 3, mode: 'date' }),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
	productId: text().notNull(),
	paddleSubscriptionId: text(),
	paddleCustomerId: text(),
	canceledAt: timestamp({ precision: 3, mode: 'date' }),
	cancelAtPeriodEnd: boolean().default(false).notNull(),
}, (table) => [
	uniqueIndex("Subscription_paddleSubscriptionId_key").using("btree", table.paddleSubscriptionId.asc().nullsLast().op("text_ops")),
	index("Subscription_planId_idx").using("btree", table.planId.asc().nullsLast().op("text_ops")),
	index("Subscription_productId_idx").using("btree", table.productId.asc().nullsLast().op("text_ops")),
	uniqueIndex("Subscription_userId_productId_key").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.productId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Subscription_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [plan.id],
			name: "Subscription_planId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [product.id],
			name: "Subscription_productId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const address = pgTable("Address", {
	id: text().primaryKey().notNull().$defaultFn(() => createId()),
	userId: text().notNull(),
	addressLine1: text().notNull(),
	addressLine2: text(),
	city: text().notNull(),
	state: text().notNull(),
	country: text().notNull(),
	postcode: text().notNull(),
	isDefault: boolean().default(false).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
	index("Address_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Address_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const product = pgTable("Product", {
	id: text().primaryKey().notNull(),
	label: text().notNull(),
	slug: text().notNull(),
	tagline: text(),
	isActive: boolean().default(true).notNull(),
	sortOrder: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
	showOnLanding: boolean().default(true).notNull(),
}, (table) => [
	index("Product_isActive_sortOrder_idx").using("btree", table.isActive.asc().nullsLast().op("int4_ops"), table.sortOrder.asc().nullsLast().op("int4_ops")),
	uniqueIndex("Product_slug_key").using("btree", table.slug.asc().nullsLast().op("text_ops")),
]);

export const user = pgTable("User", {
	id: text().primaryKey().notNull().$defaultFn(() => createId()),
	email: text().notNull(),
	passwordHash: text().notNull(),
	name: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
	role: role().default('ADMIN').notNull(),
	firstName: text(),
	lastName: text(),
	phone: text(),
	emailVerifiedAt: timestamp({ precision: 3, mode: 'date' }),
	username: text(),
	company: text(),
	companyEmail: text(),
	jobTitle: text(),
	alternatePhone: text(),
	website: text(),
	taxId: text(),
	industry: text(),
	companySize: text(),
	preferredCurrency: text(),
	notes: text(),
	/** When the customer finished or skipped the portal tour; null means it has not been offered yet. */
	tourCompletedAt: timestamp({ precision: 3, mode: 'date' }),
}, (table) => [
	uniqueIndex("User_email_key").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("User_role_idx").using("btree", table.role.asc().nullsLast().op("enum_ops")),
	uniqueIndex("User_username_key").using("btree", table.username.asc().nullsLast().op("text_ops")),
]);

export const billingRecord = pgTable("BillingRecord", {
	id: text().primaryKey().notNull().$defaultFn(() => createId()),
	userId: text().notNull(),
	subscriptionId: text(),
	tenantId: uuid(),
	invoiceNumber: text().notNull(),
	description: text().notNull(),
	amount: doublePrecision().notNull(),
	currency: text().default('USD').notNull(),
	status: billingStatus().default('DRAFT').notNull(),
	periodStart: timestamp({ precision: 3, mode: 'date' }),
	periodEnd: timestamp({ precision: 3, mode: 'date' }),
	issuedAt: timestamp({ precision: 3, mode: 'date' }),
	dueDate: timestamp({ precision: 3, mode: 'date' }),
	paidAt: timestamp({ precision: 3, mode: 'date' }),
	paymentMethod: text(),
	paymentReference: text(),
	notes: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
	refundedAt: timestamp({ precision: 3, mode: 'date' }),
	refundedAmount: doublePrecision(),
}, (table) => [
	uniqueIndex("BillingRecord_invoiceNumber_key").using("btree", table.invoiceNumber.asc().nullsLast().op("text_ops")),
	index("BillingRecord_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("BillingRecord_subscriptionId_idx").using("btree", table.subscriptionId.asc().nullsLast().op("text_ops")),
	index("BillingRecord_tenantId_idx").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("BillingRecord_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "BillingRecord_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [subscription.id],
			name: "BillingRecord_subscriptionId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const emailTemplate = pgTable("EmailTemplate", {
	id: text().primaryKey().notNull().$defaultFn(() => createId()),
	name: text().notNull(),
	subject: text().notNull(),
	bodyHtml: text().notNull(),
	isActive: boolean().default(true).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
	uniqueIndex("EmailTemplate_name_key").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);

export const emailEvent = pgTable("EmailEvent", {
	eventKey: text().primaryKey().notNull(),
	templateId: text(),
	enabled: boolean().default(true).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
	foreignKey({
			columns: [table.templateId],
			foreignColumns: [emailTemplate.id],
			name: "EmailEvent_templateId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const emailAccount = pgTable("EmailAccount", {
	id: text().primaryKey().notNull().$defaultFn(() => createId()),
	label: text().notNull(),
	address: text().notNull(),
	fromName: text(),
	purpose: emailPurpose().default('TRANSACTIONAL').notNull(),
	smtpHost: text().notNull(),
	smtpPort: integer().default(587).notNull(),
	smtpSecure: boolean().default(false).notNull(),
	smtpUsername: text().notNull(),
	smtpPassword: text("smtpPasswordCiphertext").notNull(),
	imapHost: text(),
	imapPort: integer().default(993),
	imapSecure: boolean().default(true).notNull(),
	imapUsername: text(),
	imapPassword: text("imapPasswordCiphertext"),
	isDefault: boolean().default(false).notNull(),
	isActive: boolean().default(true).notNull(),
	lastTestedAt: timestamp({ precision: 3, mode: 'date' }),
	lastTestOk: boolean(),
	lastTestError: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
	uniqueIndex("EmailAccount_address_key").using("btree", table.address.asc().nullsLast().op("text_ops")),
	uniqueIndex("EmailAccount_one_default_idx").using("btree", table.isDefault.asc().nullsLast().op("bool_ops")).where(sql`"isDefault"`),
	index("EmailAccount_purpose_isActive_idx").using("btree", table.purpose.asc().nullsLast().op("bool_ops"), table.isActive.asc().nullsLast().op("bool_ops")),
	check("EmailAccount_smtpPort_range", sql`("smtpPort" >= 1) AND ("smtpPort" <= 65535)`),
	check("EmailAccount_imapPort_range", sql`("imapPort" IS NULL) OR (("imapPort" >= 1) AND ("imapPort" <= 65535))`),
	check("EmailAccount_imap_complete", sql`(("imapHost" IS NULL) AND ("imapUsername" IS NULL) AND ("imapPasswordCiphertext" IS NULL)) OR (("imapHost" IS NOT NULL) AND ("imapUsername" IS NOT NULL) AND ("imapPasswordCiphertext" IS NOT NULL))`),
]);

export const currency = pgTable("Currency", {
	id: text().primaryKey().notNull().$defaultFn(() => createId()),
	code: text().notNull(),
	name: text().notNull(),
	symbol: text().notNull(),
	numberFormat: text().default('#,###.##').notNull(),
	isActive: boolean().default(true).notNull(),
	sortOrder: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
	uniqueIndex("Currency_code_key").using("btree", table.code.asc().nullsLast().op("text_ops")),
	index("Currency_isActive_sortOrder_idx").using("btree", table.isActive.asc().nullsLast().op("int4_ops"), table.sortOrder.asc().nullsLast().op("int4_ops")),
	check("Currency_code_format", sql`code ~ '^[A-Z]{3,8}$'::text`),
]);

export const lead = pgTable("leads", {
	id: text().primaryKey().notNull().$defaultFn(() => createId()),
	firstName: text().notNull(),
	lastName: text().notNull(),
	email: text().notNull(),
	phone: text().notNull(),
	company: text(),
	message: text().notNull(),
	source: leadSource().default('CONTACT_FORM').notNull(),
	status: leadStatus().default('NEW').notNull(),
	notes: text(),
	userId: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
	index("leads_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("leads_status_createdAt_idx").using("btree", table.status.asc().nullsLast().op("enum_ops"), table.createdAt.asc().nullsLast().op("enum_ops")),
	index("leads_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "leads_userId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const paddleEvent = pgTable("PaddleEvent", {
	id: text().primaryKey().notNull(),
	eventType: text().notNull(),
	payload: jsonb().notNull(),
	receivedAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	status: paddleEventStatus().default('PENDING').notNull(),
	attempts: integer().default(0).notNull(),
	error: text(),
	processedAt: timestamp({ precision: 3, mode: 'date' }),
}, (table) => [
	index("PaddleEvent_eventType_receivedAt_idx").using("btree", table.eventType.asc().nullsLast().op("text_ops"), table.receivedAt.asc().nullsLast().op("timestamp_ops")),
	index("PaddleEvent_status_receivedAt_idx").using("btree", table.status.asc().nullsLast().op("timestamp_ops"), table.receivedAt.asc().nullsLast().op("timestamp_ops")),
]);

export const appCatalog = pgTable("AppCatalog", {
	id: text().primaryKey().notNull().$defaultFn(() => createId()),
	slug: text().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	category: text().notNull(),
	iconUrl: text(),
	frappeAppName: text(),
	isInstallable: boolean().default(false).notNull(),
	isActive: boolean().default(true).notNull(),
	sortOrder: integer().default(0).notNull(),
	source: text().default('image').notNull(),
	repoUrl: text(),
	branch: text(),
	defaultBranch: text(),
	branches: text().array().default([]).notNull(),
	publisher: text(),
	latestCommit: text(),
	latestCommitMessage: text(),
	latestCommitAt: timestamp({ precision: 3, mode: 'date' }),
	latestVersion: text(),
	frappeRange: text(),
	// 'compatible' | 'incompatible' | 'unknown', with the reason shown to the admin.
	compatibility: text(),
	compatibilityNote: text(),
	lastCheckedAt: timestamp({ precision: 3, mode: 'date' }),
	priceAmount: doublePrecision(),
	priceCurrency: text().default('USD').notNull(),
	paddlePriceId: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
	index("AppCatalog_isActive_sortOrder_idx").using("btree", table.isActive.asc().nullsLast().op("int4_ops"), table.sortOrder.asc().nullsLast().op("int4_ops")),
	uniqueIndex("AppCatalog_slug_key").using("btree", table.slug.asc().nullsLast().op("text_ops")),
]);

export const loginSession = pgTable("LoginSession", {
	id: text().primaryKey().notNull().$defaultFn(() => randomUUID()),
	userId: text().notNull(),
	userAgent: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	lastSeenAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	expiresAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
	revokedAt: timestamp({ precision: 3, mode: 'date' }),
}, (table) => [
	index("LoginSession_userId_revokedAt_expiresAt_idx").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.revokedAt.asc().nullsLast().op("timestamp_ops"), table.expiresAt.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "LoginSession_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const notification = pgTable("Notification", {
	id: text().primaryKey().notNull().$defaultFn(() => createId()),
	userId: text().notNull(),
	eventKey: text().notNull(),
	title: text().notNull(),
	body: text().notNull(),
	href: text(),
	readAt: timestamp({ precision: 3, mode: 'date' }),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("Notification_userId_eventKey_key").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.eventKey.asc().nullsLast().op("text_ops")),
	index("Notification_userId_readAt_createdAt_idx").using("btree", table.userId.asc().nullsLast().op("timestamp_ops"), table.readAt.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Notification_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const siteEmailEvent = pgTable("SiteEmailEvent", {
	id: text().primaryKey().notNull().$defaultFn(() => createId()),
	siteId: text().notNull(),
	eventKey: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("SiteEmailEvent_siteId_eventKey_key").using("btree", table.siteId.asc().nullsLast().op("text_ops"), table.eventKey.asc().nullsLast().op("text_ops")),
]);

export const plan = pgTable("Plan", {
	id: text().primaryKey().notNull().$defaultFn(() => createId()),
	name: text().notNull(),
	slug: text().notNull(),
	tagline: text(),
	priceUnit: priceUnit().default('FLAT_MONTHLY').notNull(),
	priceAmount: doublePrecision(),
	transactionFeePercent: doublePrecision(),
	userLimit: integer(),
	features: text().array().notNull().default(sql`ARRAY[]::text[]`),
	isActive: boolean().default(true).notNull(),
	sortOrder: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
	productId: text().notNull(),
	paddlePriceId: text(),
	currencyId: text(),
	vcpu: doublePrecision(),
	ramMb: integer(),
	storageGb: integer(),
	// Days of free use a new customer gets on this plan; null or 0 = no trial.
	trialDays: integer(),
}, (table) => [
	index("Plan_currencyId_idx").using("btree", table.currencyId.asc().nullsLast().op("text_ops")),
	uniqueIndex("Plan_paddlePriceId_key").using("btree", table.paddlePriceId.asc().nullsLast().op("text_ops")),
	index("Plan_productId_isActive_idx").using("btree", table.productId.asc().nullsLast().op("text_ops"), table.isActive.asc().nullsLast().op("text_ops")),
	uniqueIndex("Plan_productId_slug_key").using("btree", table.productId.asc().nullsLast().op("text_ops"), table.slug.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [product.id],
			name: "Plan_productId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.currencyId],
			foreignColumns: [currency.id],
			name: "Plan_currencyId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const appPurchase = pgTable("AppPurchase", {
	id: text().primaryKey().notNull().$defaultFn(() => createId()),
	userId: text().notNull(),
	appId: text().notNull(),
	siteId: text().notNull(),
	status: text().default('ACTIVE').notNull(),
	priceAmount: doublePrecision().notNull(),
	currency: text().notNull(),
	billingMode: text().notNull(),
	paddleSubscriptionId: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	canceledAt: timestamp({ precision: 3, mode: 'date' }),
}, (table) => [
	index("AppPurchase_userId_status_idx").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	uniqueIndex("AppPurchase_site_app_active_key").using("btree", table.siteId.asc().nullsLast().op("text_ops"), table.appId.asc().nullsLast().op("text_ops")).where(sql`status = 'ACTIVE'`),
]);
