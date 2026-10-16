import { getCustomerSession } from '@/lib/customer-session';
import { controller } from '@/lib/controller-client';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string; name: string }> },
) {
    const session = await getCustomerSession();
    if (!session)
        return Response.json({ error: 'Sign in required.' }, { status: 401 });
    const { id, name } = await params;
    // Ownership is checked by the controller (it is given the signed-in user's id).
    const upstream = await controller.sites.backupFile(id, session.userId, name).catch(() => null);
    if (!upstream || !upstream.ok || !upstream.body)
        return Response.json(
            { error: 'The backup could not be downloaded right now.' },
            { status: upstream?.status === 404 ? 404 : 503 },
        );
    return new Response(upstream.body, {
        headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${name.replace(/[^A-Za-z0-9._-]/g, '_')}"`,
            'Cache-Control': 'private, no-store',
        },
    });
}
