import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireCustomerSession } from '@/lib/customer-session';
import { asRecord, asString } from '@/lib/paddle-data';
import { StepIndicator } from '@/components/customer/step-indicator';
import { listIdleSubscriptions } from '@/lib/subscription-claims';
import { SitePayment } from './site-payment';

export default async function SiteOrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paid?: string }> }) {
    const session = await requireCustomerSession();
    const { id } = await params;
    const { paid } = await searchParams;
    const order = await db.query.siteOrder.findFirst({ where: and(eq(schema.siteOrder.id, id), eq(schema.siteOrder.userId, session.userId)) });
    if (!order) notFound();
    if (order.siteId) redirect(`/dashboard/sites/${order.siteId}`);
    
    // A plan the customer already pays for with no site on it runs this site: nothing more to pay.
    const covered = order.trialDays === 0 && !order.paddleTransactionId && !order.paidAt && ['DRAFT', 'AWAITING_PAYMENT'].includes(order.status)
        ? (await listIdleSubscriptions(session.userId, order.planId).catch(() => [])).length > 0
        : false;
    const summary = asRecord(order.summary);
    return <div className="mx-auto portal-page">
        <Link href="/dashboard/sites" className="text-sm text-muted-foreground hover:underline">Back to sites</Link>
        <h1 className="portal-page-title mt-6">{order.trialDays ? 'Confirm your free trial' : covered ? 'Confirm your site' : 'Payment'}</h1>
        <div className="mt-8 portal-stack portal-panel-padding portal-surface">
            <StepIndicator labels={['Site', 'Company', 'Plan', 'Apps', 'Account', 'Payment']} step={6} />
            <div><h2 className="text-lg">{asString(summary.slug)}</h2><p className="mt-2 text-sm text-muted-foreground">{asString(summary.companyName)} · {asString(summary.planName)}</p></div>
            <p className="text-sm">Your setup details are saved. {order.trialDays ? `This plan includes a ${order.trialDays}-day free trial.` : covered ? 'You already have an active subscription for this plan with no site on it. It will run this site, so there is nothing to pay.' : 'Complete payment to start provisioning. This site has its own subscription.'}</p>
            <SitePayment orderId={order.id} trial={order.trialDays > 0} initialStatus={order.status} transactionId={order.paddleTransactionId} returning={paid === '1'} covered={covered} />
        </div>
    </div>;
}
