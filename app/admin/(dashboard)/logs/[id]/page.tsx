import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { controller, ControllerError } from '@/lib/controller-client';
import { requireAdmin } from '@/lib/admin-session';
import { Badge } from '@/components/ui/badge';
import { ControllerOffline } from '@/components/admin/controller-offline';
import { OPERATION_STATUS_BADGE, humanizeStatus } from '@/lib/controller-status';
import { formatDateTime } from '@/lib/admin-format';

/** Whole-text block: nothing is clamped, so a traceback can be read and copied in full. */
function Pre({ children, tone }: { children: string; tone?: 'error' }) {
    return (
        <pre
            className={`mt-2 max-h-128 overflow-auto whitespace-pre-wrap break-words rounded-lg border p-4 font-mono text-xs leading-5 ${tone === 'error' ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-border bg-muted text-foreground'}`}
        >
            {children}
        </pre>
    );
}

export default async function OperationDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    await requireAdmin();
    const { id } = await params;
    let data;
    try {
        data = await controller.logs.operation(id);
    } catch (error) {
        if (error instanceof ControllerError) {
            if (error.status === 404) notFound();
            return <ControllerOffline message={error.message} />;
        }
        throw error;
    }
    const { operation, steps } = data;

    return (
        <div className="portal-detail">
            <Link
                href="/admin/logs"
                className="mb-6 inline-flex items-center gap-2 portal-text-body font-semibold text-muted-foreground hover:text-foreground/80"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to activity log
            </Link>
            <div className="flex flex-wrap items-center gap-3">
                <h1 className="portal-page-title">{operation.label}</h1>
                <Badge variant={OPERATION_STATUS_BADGE[operation.status] ?? 'neutral'}>
                    {humanizeStatus(operation.status)}
                </Badge>
            </div>
            <p className="mt-2 portal-text-body text-muted-foreground">
                {operation.kind} · {operation.category}
                {operation.tenant_slug ? ` · ${operation.tenant_slug}` : ''}
                {operation.server_name ? ` · ${operation.server_name}` : ''}
                {operation.started_at ? ` · ${formatDateTime(operation.started_at)}` : ''}
                {operation.duration_ms != null ? ` · ${(operation.duration_ms / 1000).toFixed(1)}s` : ''}
            </p>

            {operation.error_message && (
                <section className="mt-8">
                    <h2 className="">Error</h2>
                    <Pre tone="error">{operation.error_message}</Pre>
                </section>
            )}

            <section className="mt-8">
                <h2 className="">Steps ({steps.length})</h2>
                <ol className="mt-3 space-y-gap">
                    {steps.map((step) => (
                        <li key={step.id} className="rounded-xl border border-border p-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="font-medium">{step.step_name ?? step.action}</span>
                                <Badge variant={OPERATION_STATUS_BADGE[step.status] ?? 'neutral'}>
                                    {humanizeStatus(step.status)}
                                </Badge>
                                <span className="portal-text-caption text-muted-foreground">
                                    {formatDateTime(step.created_at)}
                                    {step.duration_ms != null ? ` · ${step.duration_ms} ms` : ''}
                                </span>
                            </div>
                            {step.message && (
                                <p className="mt-2 portal-text-body text-foreground/80">{step.message}</p>
                            )}
                            {step.error_message && <Pre tone="error">{step.error_message}</Pre>}
                            {step.details && Object.keys(step.details).length > 0 && (
                                <details className="mt-3">
                                    <summary className="cursor-pointer portal-text-caption font-semibold text-foreground/70">
                                        Details
                                    </summary>
                                    <Pre>{JSON.stringify(step.details, null, 2)}</Pre>
                                </details>
                            )}
                        </li>
                    ))}
                </ol>
            </section>
        </div>
    );
}
