import { getCustomerSession } from '@/lib/customer-session';
import { controller } from '@/lib/controller-client';

export async function GET(request: Request) {
    const session = await getCustomerSession();
    if (!session)
        return Response.json({ error: 'Sign in required.' }, { status: 401 });
    const slug = new URL(request.url).searchParams.get('slug') || '';
    if (slug.length > 64)
        return Response.json({ available: false, reason: 'Name is too long.' });
    try {
        return Response.json(await controller.sites.checkSlug(slug), {
            headers: { 'Cache-Control': 'private, no-store' },
        });
    } catch {
        return Response.json(
            { error: 'Could not check availability.' },
            { status: 503 },
        );
    }
}
