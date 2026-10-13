import { getCustomerSession } from '@/lib/customer-session';
import { controller, ControllerError } from '@/lib/controller-client';
import { recordSiteNotification } from '@/lib/customer-notifications';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await getCustomerSession();
    if (!session)
        return Response.json({ error: 'Sign in required.' }, { status: 401 });
    const { id } = await params;
    try {
        const site = await controller.sites.get(id, session.userId);
        await recordSiteNotification(session.userId, site);
        return Response.json(site, {
            headers: { 'Cache-Control': 'private, no-store' },
        });
    } catch (error) {
        return Response.json(
            { error: 'Site status is unavailable. Try again shortly.' },
            {
                status:
                    error instanceof ControllerError && error.status === 404
                        ? 404
                        : 503,
            },
        );
    }
}
