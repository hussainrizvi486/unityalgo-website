import { getCustomerSession } from '@/lib/customer-session';
import { controller, ControllerError, type MetricsRange } from '@/lib/controller-client';

const RANGES: MetricsRange[] = ['1h', '6h', '24h', '7d', '30d'];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getCustomerSession();
    if (!session) return Response.json({ error: 'Sign in required.' }, { status: 401 });
    const { id } = await params;
    const asked = new URL(request.url).searchParams.get('range') as MetricsRange;
    try {
        const metrics = await controller.sites.metrics(id, session.userId, RANGES.includes(asked) ? asked : '24h');
        return Response.json(metrics, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (error) {
        return Response.json(
            { error: 'Monitoring data is unavailable. Try again shortly.' },
            { status: error instanceof ControllerError && error.status === 404 ? 404 : 503 },
        );
    }
}
