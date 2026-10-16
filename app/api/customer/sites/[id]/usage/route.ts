import { getCustomerSession } from '@/lib/customer-session';
import { controller, ControllerError } from '@/lib/controller-client';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await getCustomerSession();
    if (!session)
        return Response.json({ error: 'Sign in required.' }, { status: 401 });
    const { id } = await params;
    try {
        return Response.json(await controller.sites.usage(id, session.userId), {
            headers: { 'Cache-Control': 'private, no-store' },
        });
    } catch (error) {
        return Response.json(
            { error: 'Usage is unavailable right now.' },
            { status: error instanceof ControllerError && error.status === 404 ? 404 : 503 },
        );
    }
}
