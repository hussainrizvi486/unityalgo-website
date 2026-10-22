import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireCustomerSession } from '@/lib/customer-session';
import { asRecord, asString } from '@/lib/paddle-data';
import { StepIndicator } from '@/components/customer/step-indicator';
import { SitePayment } from './site-payment';

export default async function SiteOrderPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await requireCustomerSession();
    const { id } = await params;
    const order = await db.query.siteOrder.findFirst({ where: and(eq(schema.siteOrder.id, id), eq(schema.siteOrder.userId, session.userId)) });
    if (!order) notFound();
    if (order.siteId) redirect(`/dashboard/sites/${order.siteId}`);
    const summary = asRecord(order.summary);
    return <div className="mx-auto portal-page">
        <Link href="/dashboard/sites" className="text-sm text-muted-foreground hover:underline">Back to sites</Link>
        <h1 className="portal-page-title mt-6">{order.trialDays ? 'Confirm your free trial' : 'Payment'}</h1>
        <div className="mt-8 portal-stack portal-panel-padding portal-surface">
            <StepIndicator labels={['Site', 'Company', 'Plan', 'Apps', 'Account', 'Payment']} step={6} />
            <div><h2 className="text-lg">{asString(summary.slug)}</h2><p className="mt-2 text-sm text-muted-foreground">{asString(summary.companyName)} · {asString(summary.planName)}</p></div>
            <p className="text-sm">Your setup details are saved. {order.trialDays ? `This plan includes a ${order.trialDays}-day free trial.` : 'Complete payment to start provisioning. This site has its own subscription.'}</p>
            <SitePayment orderId={order.id} trial={order.trialDays > 0} initialStatus={order.status} transactionId={order.paddleTransactionId} />
        </div>
    </div>;
}
