/**
 * One-time migration of the controller's own identity tables into the shared
 * platform tables.
 *
 *   customers        -> User (role = CUSTOMER)
 *   addresses        -> Address
 *   billing_records  -> BillingRecord
 *   tenants.customer_id -> tenants.user_id
 *
 * Customers are matched to existing Users by email (case-insensitive). A
 * match is updated in place, filling only fields the User does not already
 * have — the platform User is treated as authoritative, since it is the
 * record the person actually logs in with. Anything unmatched is created as
 * a new CUSTOMER with an unusable password, so it cannot be signed into
 * until the person goes through password reset.
 *
 * Runs read-only by default and prints exactly what it would do:
 *
 *   npm run migrate:controller-identity            # dry run (default)
 *   npm run migrate:controller-identity -- --apply # actually write
 *
 * Safe to re-run: every write is keyed on a natural unique column
 * (email / invoice_number) so a second pass is a no-op.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomBytes } from 'crypto';

const APPLY = process.argv.includes('--apply');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

interface ControllerCustomer {
    id: string;
    name: string | null;
    email: string;
    company: string | null;
    phone: string | null;
    first_name: string | null;
    last_name: string | null;
    job_title: string | null;
    alternate_phone: string | null;
    website: string | null;
    tax_id: string | null;
    industry: string | null;
    company_size: string | null;
    preferred_currency: string | null;
    notes: string | null;
    created_at: Date;
}

interface ControllerAddress {
    id: string;
    customer_id: string;
    line1: string;
    line2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
    is_default: boolean;
}

interface ControllerBilling {
    id: string;
    customer_id: string;
    tenant_id: string | null;
    invoice_number: string;
    description: string;
    amount: string;
    currency: string;
    status: string;
    period_start: Date | null;
    period_end: Date | null;
    issued_at: Date | null;
    due_date: Date | null;
    paid_at: Date | null;
    payment_method: string | null;
    payment_reference: string | null;
    notes: string | null;
    created_at: Date;
}

/** Split a legacy single `name` column into first/last on the first space. */
function splitName(customer: ControllerCustomer) {
    if (customer.first_name || customer.last_name) {
        return { firstName: customer.first_name, lastName: customer.last_name };
    }
    const parts = (customer.name ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: null, lastName: null };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') || null };
}

const BILLING_STATUS: Record<string, 'DRAFT' | 'PENDING' | 'PAID' | 'OVERDUE' | 'REFUNDED' | 'CANCELLED'> = {
    draft: 'DRAFT',
    pending: 'PENDING',
    paid: 'PAID',
    overdue: 'OVERDUE',
    refunded: 'REFUNDED',
    cancelled: 'CANCELLED',
    canceled: 'CANCELLED',
};

/**
 * A password hash that no password can produce, so a migrated account exists
 * but cannot be signed into until the person resets it. Not a bcrypt hash at
 * all, so bcrypt.compare returns false rather than throwing.
 */
function unusablePasswordHash() {
    return `!migrated:${randomBytes(24).toString('hex')}`;
}

async function tableExists(name: string) {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = ${name}
        ) AS exists
    `;
    return rows[0]?.exists === true;
}

async function main() {
    console.log(`${BOLD}Controller identity migration${RESET}`);
    console.log(APPLY
        ? `${YELLOW}APPLY mode — changes will be written.${RESET}`
        : `${DIM}Dry run. Re-run with --apply to write. Nothing is changed now.${RESET}`);

    for (const t of ['customers', 'addresses', 'billing_records']) {
        if (!(await tableExists(t))) {
            console.log(`\nTable "${t}" does not exist — migration already completed, or the controller schema is not present. Nothing to do.`);
            return;
        }
    }

    const customers = await prisma.$queryRaw<ControllerCustomer[]>`SELECT * FROM customers ORDER BY created_at ASC`;
    const addresses = await prisma.$queryRaw<ControllerAddress[]>`SELECT * FROM addresses`;
    const billing = await prisma.$queryRaw<ControllerBilling[]>`SELECT * FROM billing_records`;

    console.log(`\nFound ${customers.length} customers, ${addresses.length} addresses, ${billing.length} billing records.`);

    if (customers.length === 0) {
        console.log('Nothing to migrate.');
        return;
    }

    // customer.id (uuid) -> User.id (cuid), needed to remap the child rows.
    const customerToUser = new Map<string, string>();
    let matched = 0;
    let created = 0;

    console.log(`\n${BOLD}Customers${RESET}`);
    for (const customer of customers) {
        const email = customer.email.trim().toLowerCase();
        const existing = await prisma.user.findUnique({ where: { email } });
        const { firstName, lastName } = splitName(customer);

        // Only fill gaps — never overwrite a value the platform already has.
        const profile = {
            firstName: existing?.firstName ?? firstName,
            lastName: existing?.lastName ?? lastName,
            phone: existing?.phone ?? customer.phone,
            company: existing?.company ?? customer.company,
            jobTitle: existing?.jobTitle ?? customer.job_title,
            alternatePhone: existing?.alternatePhone ?? customer.alternate_phone,
            website: existing?.website ?? customer.website,
            taxId: existing?.taxId ?? customer.tax_id,
            industry: existing?.industry ?? customer.industry,
            companySize: existing?.companySize ?? customer.company_size,
            preferredCurrency: existing?.preferredCurrency ?? customer.preferred_currency,
            notes: existing?.notes ?? customer.notes,
        };

        if (existing) {
            matched++;
            const role = existing.role === 'ADMIN' ? ' (ADMIN — role left unchanged)' : '';
            console.log(`  ${GREEN}match${RESET}  ${email}${role}`);
            if (APPLY) {
                await prisma.user.update({ where: { id: existing.id }, data: profile });
            }
            customerToUser.set(customer.id, existing.id);
        } else {
            created++;
            console.log(`  ${YELLOW}new${RESET}    ${email}`);
            if (APPLY) {
                const user = await prisma.user.create({
                    data: {
                        email,
                        passwordHash: unusablePasswordHash(),
                        role: 'CUSTOMER',
                        name: customer.name,
                        emailVerifiedAt: null,
                        ...profile,
                    },
                });
                customerToUser.set(customer.id, user.id);
            } else {
                customerToUser.set(customer.id, `<new-user-for:${email}>`);
            }
        }
    }
    console.log(`  ${DIM}${matched} matched existing users, ${created} to create${RESET}`);

    // --- addresses ----------------------------------------------------------
    console.log(`\n${BOLD}Addresses${RESET}`);
    let addressesMigrated = 0;
    let addressesSkipped = 0;
    for (const address of addresses) {
        const userId = customerToUser.get(address.customer_id);
        if (!userId) {
            addressesSkipped++;
            continue;
        }
        // Required on the platform side but nullable in the controller —
        // fall back rather than dropping the row.
        const data = {
            addressLine1: address.line1,
            addressLine2: address.line2,
            city: address.city ?? '—',
            state: address.state ?? '—',
            country: address.country ?? '—',
            postcode: address.postal_code ?? '—',
            isDefault: address.is_default,
        };
        if (APPLY) {
            const duplicate = await prisma.address.findFirst({
                where: { userId, addressLine1: data.addressLine1, postcode: data.postcode },
            });
            if (duplicate) {
                addressesSkipped++;
                continue;
            }
            await prisma.address.create({ data: { ...data, userId } });
        }
        addressesMigrated++;
    }
    console.log(`  ${addressesMigrated} to migrate, ${addressesSkipped} skipped (no owner or already present)`);

    // --- billing ------------------------------------------------------------
    console.log(`\n${BOLD}Billing records${RESET}`);
    let billingMigrated = 0;
    let billingSkipped = 0;
    for (const record of billing) {
        const userId = customerToUser.get(record.customer_id);
        if (!userId) {
            billingSkipped++;
            continue;
        }
        if (APPLY) {
            const existing = await prisma.billingRecord.findUnique({
                where: { invoiceNumber: record.invoice_number },
            });
            if (existing) {
                billingSkipped++;
                continue;
            }
            await prisma.billingRecord.create({
                data: {
                    userId,
                    tenantId: record.tenant_id,
                    invoiceNumber: record.invoice_number,
                    description: record.description,
                    amount: Number(record.amount),
                    currency: record.currency,
                    status: BILLING_STATUS[record.status?.toLowerCase()] ?? 'DRAFT',
                    periodStart: record.period_start,
                    periodEnd: record.period_end,
                    issuedAt: record.issued_at,
                    dueDate: record.due_date,
                    paidAt: record.paid_at,
                    paymentMethod: record.payment_method,
                    paymentReference: record.payment_reference,
                    notes: record.notes,
                },
            });
        }
        billingMigrated++;
    }
    console.log(`  ${billingMigrated} to migrate, ${billingSkipped} skipped (no owner or already present)`);

    // --- repoint tenants ----------------------------------------------------
    console.log(`\n${BOLD}Tenants${RESET}`);
    const tenantRows = await prisma.$queryRaw<Array<{ id: string; customer_id: string | null; tenant_slug: string }>>`
        SELECT id, customer_id, tenant_slug FROM tenants
    `;
    let repointed = 0;
    for (const tenant of tenantRows) {
        if (!tenant.customer_id) continue;
        const userId = customerToUser.get(tenant.customer_id);
        if (!userId) continue;
        console.log(`  ${tenant.tenant_slug} → user ${userId}`);
        if (APPLY) {
            await prisma.$executeRaw`UPDATE tenants SET user_id = ${userId} WHERE id = ${tenant.id}::uuid`;
        }
        repointed++;
    }
    console.log(`  ${repointed} tenants to repoint`);

    console.log(`\n${BOLD}Summary${RESET}`);
    console.log(`  users:    ${matched} matched, ${created} created`);
    console.log(`  addresses: ${addressesMigrated}`);
    console.log(`  billing:   ${billingMigrated}`);
    console.log(`  tenants:   ${repointed} repointed`);

    if (!APPLY) {
        console.log(`\n${YELLOW}Dry run — nothing was written. Re-run with --apply once the above looks right.${RESET}`);
    } else {
        console.log(`\n${GREEN}Applied.${RESET} Verify, then drop the retired tables with the controller's`);
        console.log(`  follow-up Alembic migration (c9d3a71e5b28).`);
    }
}

main()
    .catch((err) => {
        console.error('\nMigration failed:', err instanceof Error ? err.message : err);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
