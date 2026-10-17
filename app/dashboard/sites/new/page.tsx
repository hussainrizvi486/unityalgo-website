import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { trialDaysFor, trialEligibility } from '@/lib/site-trials';
import { requireCustomer } from '@/lib/customer-session';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { controller } from '@/lib/controller-client';
import { Notice } from '@/components/ui/notice';
import { formatPlanPrice } from '@/lib/pricing';
import { listAlgoSuitePlans } from '@/lib/products';
import { SiteForm } from './site-form';
export const metadata = { title: 'Create a site' };
export default async function CreateSitePage({
    searchParams,
}: {
    searchParams: Promise<{ app?: string }>;
}) {
    const user = await requireCustomer();
    const { app } = await searchParams;
    const catalog = await db
        .select({
            id: schema.appCatalog.id,
            name: schema.appCatalog.name,
            isInstallable: schema.appCatalog.isInstallable,
            frappeAppName: schema.appCatalog.frappeAppName,
            source: schema.appCatalog.source,
            priceAmount: schema.appCatalog.priceAmount,
        })
        .from(schema.appCatalog)
        .where(eq(schema.appCatalog.isActive, true))
        .orderBy(asc(schema.appCatalog.sortOrder));
    const [plans, currencies, eligibility] = await Promise.all([
        listAlgoSuitePlans(),
        db
            .select({ code: schema.currency.code, name: schema.currency.name })
            .from(schema.currency)
            .where(eq(schema.currency.isActive, true))
            .orderBy(asc(schema.currency.sortOrder), asc(schema.currency.code)),
        trialEligibility(user.id),
    ]);
    let capabilities;
    try {
        capabilities = await controller.sites.capabilities();
    } catch {
        capabilities = null;
    }
    return (
        <div className="mx-auto portal-page">
            <Link
                href="/dashboard/sites"
                className="portal-text-body text-muted-foreground hover:underline"
            >
                Back to sites
            </Link>
            <h1 className="portal-page-title mt-6">
                Create a Frappe site
            </h1>
            <p className="mt-3 portal-text-body leading-7 text-foreground/70">
                Answer a few questions and we will deploy your ERP on an
                eligible server automatically.
            </p>
            {!capabilities?.configured && (
                <Notice tone="warning" className="mt-6">
                    Site creation is not available yet. Contact support or try
                    again when site hosting is configured.
                </Notice>
            )}
            {capabilities?.configured && capabilities.accepting === false && (
                <Notice tone="warning" className="mt-6">
                    We are at full capacity right now, so new sites cannot be
                    created. We are adding servers and will open site creation
                    again shortly. Please check back soon.
                </Notice>
            )}
            <SiteForm
                requestKey={randomUUID()}
                selectedApp={app}
                domainSuffix={capabilities?.domain_suffix || ''}
                available={Boolean(capabilities?.configured && capabilities.accepting !== false)}
                currencies={currencies}
                plans={plans.map((plan) => ({
                    id: plan.id,
                    name: plan.name,
                    tagline: plan.tagline,
                    features: plan.features,
                    price: formatPlanPrice(plan),
                    userLimit: plan.userLimit,
                    vcpu: plan.vcpu,
                    ramMb: plan.ramMb,
                    storageGb: plan.storageGb,
                    trialDays: trialDaysFor(plan, eligibility),
                    trialUsed: Boolean(plan.trialDays) && eligibility.used.has(plan.id) && !eligibility.subscribed.has(plan.id),
                }))}
                // A site starts with free apps that ship in the image; repository and paid apps are added from its page, once it exists.
                apps={catalog.filter((item) => item.source === 'image' && !((item.priceAmount ?? 0) > 0)).map((item) => ({
                    id: item.id,
                    name: item.name,
                    available: Boolean(
                        item.isInstallable &&
                        item.frappeAppName &&
                        capabilities?.apps.includes(item.frappeAppName),
                    ),
                }))}
            />
        </div>
    );
}
