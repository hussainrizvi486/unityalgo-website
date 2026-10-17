import { getCustomerSession } from '@/lib/customer-session';
import { controller, ControllerError } from '@/lib/controller-client';
import { recordSiteNotification } from '@/lib/customer-notifications';
import { eventStream } from '@/lib/event-stream';
import { siteIsBusy } from '@/lib/site-state';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Live status of one of the signed-in customer's sites. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getCustomerSession();
    if (!session) return Response.json({ error: 'Sign in required.' }, { status: 401 });
    const { id } = await params;
    return eventStream(
        request,
        async () => {
            try {
                const site = await controller.sites.get(id, session.userId);
                await recordSiteNotification(session.userId, site);
                return site;
            } catch (error) {
                if (error instanceof ControllerError && error.status === 404) return null;
                throw error;
            }
        },
        { busy: (value) => siteIsBusy(value as Parameters<typeof siteIsBusy>[0]) },
    );
}
