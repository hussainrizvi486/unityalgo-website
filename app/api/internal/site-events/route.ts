import { timingSafeEqual } from 'node:crypto';
import { controller } from '@/lib/controller-client';
import { recordSiteNotification } from '@/lib/customer-notifications';

export async function POST(request: Request) {
    const expected = process.env.CONTROLLER_INTERNAL_API_KEY;
    const given = request.headers.get('x-controller-key') || '';
    if (
        !expected ||
        Buffer.byteLength(given) !== Buffer.byteLength(expected) ||
        !timingSafeEqual(Buffer.from(given), Buffer.from(expected))
    )
        return Response.json({ error: 'Unauthorised.' }, { status: 401 });
    let data;
    try {
        data = await request.json();
    } catch {
        return Response.json({ error: 'Invalid request.' }, { status: 400 });
    }
    if (
        !data ||
        typeof data.site_id !== 'string' ||
        typeof data.user_id !== 'string'
    )
        return Response.json({ error: 'Invalid event.' }, { status: 400 });
    // Fetch authoritative state and ownership rather than trusting event contents.
    try {
        const site = await controller.sites.get(data.site_id, data.user_id);
        await recordSiteNotification(data.user_id, site);
        return Response.json({ ok: true });
    } catch {
        return Response.json(
            { error: 'Event could not be recorded.' },
            { status: 503 },
        );
    }
}
