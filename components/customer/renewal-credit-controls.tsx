import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { RenewalCreditButtons } from './renewal-credit-buttons';

export async function RenewalCreditControls({ subscriptionId }: { subscriptionId: string }) {
    const subscription = await db.query.subscription.findFirst({ where: eq(schema.subscription.id, subscriptionId) });
    if (!subscription?.paddleSubscriptionId || subscription.status !== 'ACTIVE') return null;
    const scheduled = await db.query.creditRedemption.findFirst({ where: and(eq(schema.creditRedemption.paddleSubscriptionId, subscription.paddleSubscriptionId), eq(schema.creditRedemption.kind, 'RENEWAL'), eq(schema.creditRedemption.status, 'RESERVED')) });
    return <RenewalCreditButtons subscriptionId={subscriptionId} redemptionId={scheduled?.id} />;
}
