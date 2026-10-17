import { getCustomerSession } from '@/lib/customer-session';
import { controller } from '@/lib/controller-client';
import { recordSiteNotification } from '@/lib/customer-notifications';
import { eventStream } from '@/lib/event-stream';
import { siteIsBusy } from '@/lib/site-state';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Live list of the signed-in customer's sites, for the Sites page. */
export async function GET(request: Request) {
    const session = await getCustomerSession();
    if (!session) return Response.json({ error: 'Sign in required.' }, { status: 401 });
    return eventStream(
        request,
        async () => {
            const { results } = await controller.sites.list(session.userId);
            await Promise.all(results.map((site) => recordSiteNotification(session.userId, site)));
            return results;
        },
        { busy: (value) => (value as Parameters<typeof siteIsBusy>[0][]).some(siteIsBusy) },
    );
}
