import { isAdminSession } from '@/lib/admin-session';
import { controller, ControllerError, type MetricsRange } from '@/lib/controller-client';

const RANGES: MetricsRange[] = ['1h', '6h', '24h', '7d', '30d'];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!(await isAdminSession())) return Response.json({ error: 'Admin sign-in required.' }, { status: 401 });
    const { id } = await params;
    const asked = new URL(request.url).searchParams.get('range') as MetricsRange;
    try {
        const metrics = await controller.sites.adminMetrics(id, RANGES.includes(asked) ? asked : '24h');
        return Response.json(metrics, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (error) {
        return Response.json(
            { error: error instanceof ControllerError ? error.message : 'Monitoring data is unavailable.' },
            { status: error instanceof ControllerError && error.status === 404 ? 404 : 503 },
        );
    }
}
