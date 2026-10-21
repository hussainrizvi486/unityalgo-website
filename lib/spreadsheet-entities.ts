import 'server-only';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db, errorText, schema } from '@/lib/db';
import { slugify } from '@/lib/slug';
import { LEAD_STATUSES } from '@/lib/leads';
import type { Cell, ImportResult, SheetColumn } from '@/lib/spreadsheet';

export type SpreadsheetEntity = 'leads' | 'plans';

type Values = Record<string, string>;
/** Fields to write on an update: only those whose column is in the uploaded sheet, so a missing column leaves the data alone. */
function present<T extends Record<string, unknown>>(fields: T, headers: Record<keyof T, string>, columns: Set<string>, always: (keyof T)[]) {
    return Object.fromEntries(
        Object.entries(fields).filter(([key]) => always.includes(key) || columns.has(headers[key as keyof T])),
    ) as Partial<T>;
}

const emptyResult = (): ImportResult => ({ created: 0, updated: 0, skipped: 0, errors: [] });

const yes = (value: string, fallback: boolean) => {
    const text = value.trim().toLowerCase();
    if (!text) return fallback;
    if (['yes', 'y', 'true', '1', 'active', 'enabled'].includes(text)) return true;
    if (['no', 'n', 'false', '0', 'inactive', 'disabled'].includes(text)) return false;
    throw new Error(`"${value}" is not Yes or No.`);
};

function number(value: string, label: string, options: { integer?: boolean; max?: number } = {}) {
    if (!value.trim()) return null;
    const parsed = Number(value.replace(/,/g, ''));
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be a positive number.`);
    if (options.integer && !Number.isInteger(parsed)) throw new Error(`${label} must be a whole number.`);
    if (options.max != null && parsed > options.max) throw new Error(`${label} cannot be more than ${options.max}.`);
    return parsed;
}

// ---------------------------------------------------------------- Leads

export const LEAD_COLUMNS: SheetColumn[] = [
    { header: 'ID', width: 28, note: 'Leave blank for a new lead. Keep the ID from an export to update that lead.' },
    { header: 'First Name', note: 'Required.' },
    { header: 'Last Name' },
    { header: 'Email', width: 30, note: 'Required.' },
    { header: 'Phone' },
    { header: 'Company' },
    { header: 'Message', width: 50 },
    { header: 'Source', note: 'Contact form, Imported or Added manually. New rows default to Imported.' },
    { header: 'Status', note: `One of: ${LEAD_STATUSES.join(', ')}. Defaults to NEW.` },
    { header: 'Notes', width: 40, note: 'Internal notes.' },
    { header: 'Received', note: 'Export only.' },
];

const LEAD_FIELD_HEADERS = {
    firstName: 'First Name', lastName: 'Last Name', email: 'Email', phone: 'Phone',
    company: 'Company', message: 'Message', status: 'Status', notes: 'Notes',
};

const SOURCE_BY_TEXT: Record<string, 'CONTACT_FORM' | 'IMPORT' | 'MANUAL'> = {
    contactform: 'CONTACT_FORM', imported: 'IMPORT', import: 'IMPORT', addedmanually: 'MANUAL', manual: 'MANUAL',
};

export async function exportLeads(status?: string): Promise<Cell[][]> {
    const where = status && (LEAD_STATUSES as readonly string[]).includes(status)
        ? eq(schema.lead.status, status as (typeof LEAD_STATUSES)[number])
        : undefined;
    const leads = await db.query.lead.findMany({ where, orderBy: desc(schema.lead.createdAt) });
    return leads.map((lead) => [
        lead.id, lead.firstName, lead.lastName, lead.email, lead.phone, lead.company ?? '', lead.message,
        lead.source, lead.status, lead.notes ?? '', lead.createdAt,
    ]);
}

export async function importLeads(rows: { line: number; values: Values }[], columns: Set<string> = new Set(LEAD_COLUMNS.map((c) => c.header))): Promise<ImportResult> {
    const result = emptyResult();
    const emails = [...new Set(rows.map((row) => row.values.Email.toLowerCase()).filter(Boolean))];
    const accounts = emails.length
        ? await db.select({ id: schema.user.id, email: schema.user.email }).from(schema.user).where(inArray(sql`lower(${schema.user.email})`, emails))
        : [];
    const accountByEmail = new Map(accounts.map((account) => [account.email.toLowerCase(), account.id]));

    for (const { line, values } of rows) {
        try {
            const email = (values.Email ?? '').toLowerCase();
            if (!values['First Name']) throw new Error('First Name is required.');
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email is missing or not valid.');
            const statusText = (values.Status ?? '').toUpperCase();
            if (statusText && !(LEAD_STATUSES as readonly string[]).includes(statusText)) throw new Error(`Status "${values.Status}" is not one of ${LEAD_STATUSES.join(', ')}.`);
            const status = (statusText || 'NEW') as (typeof LEAD_STATUSES)[number];
            const sourceText = (values.Source ?? '').toLowerCase().replace(/[^a-z]/g, '');
            if (sourceText && !SOURCE_BY_TEXT[sourceText]) throw new Error(`Source "${values.Source}" is not recognised.`);

            const fields = {
                firstName: values['First Name'],
                lastName: values['Last Name'] ?? '',
                email,
                phone: values.Phone ?? '',
                company: values.Company || null,
                message: values.Message ?? '',
                status,
                notes: values.Notes || null,
            };

            const id = values.ID;
            if (id) {
                const updated = await db.update(schema.lead).set(present(fields, LEAD_FIELD_HEADERS, columns, ['firstName', 'email'])).where(eq(schema.lead.id, id)).returning({ id: schema.lead.id });
                if (updated.length) { result.updated++; continue; }
            }
            const duplicate = await db.query.lead.findFirst({
                where: and(sql`lower(${schema.lead.email}) = ${email}`, eq(schema.lead.message, fields.message)),
                columns: { id: true },
            });
            if (duplicate) { result.skipped++; continue; }
            await db.insert(schema.lead).values({
                ...fields,
                source: SOURCE_BY_TEXT[sourceText] ?? 'IMPORT',
                userId: accountByEmail.get(email) ?? null,
            });
            result.created++;
        } catch (error) {
            result.errors.push({ line, message: error instanceof Error ? error.message : errorText(error) });
        }
    }
    return result;
}

// ---------------------------------------------------------------- Plans

export const PLAN_COLUMNS: SheetColumn[] = [
    { header: 'ID', width: 28, note: 'Leave blank for a new plan. Keep the ID from an export to update that plan.' },
    { header: 'Product', note: 'Required. The product slug, e.g. algosuite. See Admin → Products.' },
    { header: 'Name', width: 24, note: 'Required, even when only updating other columns.' },
    { header: 'Slug', note: 'Unique within the product. Taken from the name when blank. With no ID, a row whose Product and Slug match an existing plan updates it.' },
    { header: 'Tagline', width: 36 },
    { header: 'Price Unit', note: 'FLAT_MONTHLY or PER_USER_MONTHLY. Defaults to FLAT_MONTHLY.' },
    { header: 'Price', note: 'Leave blank for a custom quote.' },
    { header: 'Currency', note: 'Currency code such as USD. Must already exist under Admin → Currencies.' },
    { header: 'Transaction Fee %', note: 'Optional.' },
    { header: 'User Limit', note: 'Blank for unlimited.' },
    { header: 'vCPU' },
    { header: 'RAM (MB)' },
    { header: 'Storage (GB)' },
    { header: 'Trial Days', note: 'Blank or 0 for no trial. At most 365.' },
    { header: 'Features', width: 50, note: 'One feature per line inside the cell (Alt+Enter in Excel).' },
    { header: 'Active', note: 'Yes or No. Defaults to Yes.' },
    { header: 'Sort Order' },
    { header: 'Paddle Price ID', width: 24, note: 'Export only. It is ignored on import: use "Sync with Paddle" on the plan after changing a price.' },
];

const PLAN_FIELD_HEADERS = {
    productId: 'Product', name: 'Name', slug: 'Slug', tagline: 'Tagline', priceUnit: 'Price Unit', priceAmount: 'Price',
    currencyId: 'Currency', transactionFeePercent: 'Transaction Fee %', userLimit: 'User Limit', vcpu: 'vCPU',
    ramMb: 'RAM (MB)', storageGb: 'Storage (GB)', trialDays: 'Trial Days', features: 'Features', isActive: 'Active',
    sortOrder: 'Sort Order',
};

export async function exportPlans(): Promise<Cell[][]> {
    const plans = await db
        .select({ plan: schema.plan, product: schema.product.slug, currency: schema.currency.code })
        .from(schema.plan)
        .innerJoin(schema.product, eq(schema.product.id, schema.plan.productId))
        .leftJoin(schema.currency, eq(schema.currency.id, schema.plan.currencyId))
        .orderBy(schema.product.sortOrder, schema.plan.sortOrder);
    return plans.map(({ plan, product, currency }) => [
        plan.id, product, plan.name, plan.slug, plan.tagline ?? '', plan.priceUnit, plan.priceAmount, currency ?? '',
        plan.transactionFeePercent, plan.userLimit, plan.vcpu, plan.ramMb, plan.storageGb, plan.trialDays,
        plan.features.join('\n'), plan.isActive ? 'Yes' : 'No', plan.sortOrder, plan.paddlePriceId ?? '',
    ]);
}

export async function importPlans(rows: { line: number; values: Values }[], columns: Set<string> = new Set(PLAN_COLUMNS.map((c) => c.header))): Promise<ImportResult> {
    const result = emptyResult();
    const [products, currencies] = await Promise.all([
        db.select({ id: schema.product.id, slug: schema.product.slug }).from(schema.product),
        db.select({ id: schema.currency.id, code: schema.currency.code }).from(schema.currency),
    ]);
    const productId = (text: string) => products.find((p) => p.slug === slugify(text) || p.id === text)?.id;
    const currencyId = (code: string) => currencies.find((c) => c.code === code.toUpperCase())?.id;

    for (const { line, values } of rows) {
        try {
            const product = productId(values.Product ?? '');
            if (!product) throw new Error(`Product "${values.Product ?? ''}" does not exist. Add it under Admin → Products first.`);
            const name = values.Name ?? '';
            if (!name) throw new Error('Name is required.');
            const slug = slugify(values.Slug || name);
            if (!slug) throw new Error('Slug could not be worked out from the name.');

            const unit = (values['Price Unit'] || 'FLAT_MONTHLY').toUpperCase().replace(/[\s-]+/g, '_');
            if (unit !== 'FLAT_MONTHLY' && unit !== 'PER_USER_MONTHLY') throw new Error(`Price Unit "${values['Price Unit']}" must be FLAT_MONTHLY or PER_USER_MONTHLY.`);
            const currency = values.Currency ? currencyId(values.Currency) : null;
            if (values.Currency && !currency) throw new Error(`Currency "${values.Currency}" does not exist. Add it under Admin → Currencies first.`);
            const trial = number(values['Trial Days'] ?? '', 'Trial Days', { integer: true, max: 365 });

            const fields = {
                productId: product,
                name,
                slug,
                tagline: values.Tagline || null,
                priceUnit: unit as 'FLAT_MONTHLY' | 'PER_USER_MONTHLY',
                priceAmount: number(values.Price ?? '', 'Price'),
                currencyId: currency ?? null,
                transactionFeePercent: number(values['Transaction Fee %'] ?? '', 'Transaction Fee %', { max: 100 }),
                userLimit: number(values['User Limit'] ?? '', 'User Limit', { integer: true }),
                vcpu: number(values.vCPU ?? '', 'vCPU'),
                ramMb: number(values['RAM (MB)'] ?? '', 'RAM (MB)', { integer: true }),
                storageGb: number(values['Storage (GB)'] ?? '', 'Storage (GB)', { integer: true }),
                trialDays: trial && trial > 0 ? trial : null,
                features: (values.Features ?? '').split('\n').map((feature) => feature.trim()).filter(Boolean),
                isActive: yes(values.Active ?? '', true),
                sortOrder: number(values['Sort Order'] ?? '', 'Sort Order', { integer: true }) ?? 0,
            };

            const byId = values.ID ? await db.query.plan.findFirst({ where: eq(schema.plan.id, values.ID), columns: { id: true } }) : undefined;
            const existing = byId ?? await db.query.plan.findFirst({
                where: and(eq(schema.plan.productId, product), eq(schema.plan.slug, slug)),
                columns: { id: true },
            });
            if (existing) {
                await db.update(schema.plan).set(present(fields, PLAN_FIELD_HEADERS, columns, ['productId', 'name'])).where(eq(schema.plan.id, existing.id));
                result.updated++;
            } else {
                await db.insert(schema.plan).values(fields);
                result.created++;
            }
        } catch (error) {
            const text = errorText(error);
            result.errors.push({
                line,
                message: error instanceof Error && !text.includes('Failed query')
                    ? error.message
                    : text.includes('Plan_productId_slug_key') ? 'Another plan in this product already uses that slug.' : 'Could not save this row.',
            });
        }
    }
    return result;
}

export const ENTITIES = {
    leads: { sheet: 'Leads', columns: LEAD_COLUMNS, file: 'leads' },
    plans: { sheet: 'Plans', columns: PLAN_COLUMNS, file: 'plans' },
} as const;
