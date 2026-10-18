'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { fetchOperationAction, type OperationSnapshot } from '@/app/admin/controller-actions';

const TERMINAL_STATUSES = new Set(['success', 'failed', 'warning']);
const POLL_INTERVAL_MS = 2000;

export function OperationProgress({ operationId }: { operationId: string }) {
    const router = useRouter();
    const [snapshot, setSnapshot] = useState<OperationSnapshot | null>(null);
    const [settled, setSettled] = useState(false);

    useEffect(() => {
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout>;

        async function poll() {
            const result = await fetchOperationAction(operationId);
            if (cancelled) return;

            setSnapshot(result);

            if (result && TERMINAL_STATUSES.has(result.status)) {
                setSettled(true);
                // Pull in the tenant's post-operation state.
                router.refresh();
                return;
            }
            timer = setTimeout(poll, POLL_INTERVAL_MS);
        }

        poll();
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [operationId, router]);

    if (!snapshot) {
        return (
            <div className="mt-6 flex items-center gap-2 rounded-md bg-primary/10 px-3.5 py-2.5 portal-text-body text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />Starting…
            </div>
        );
    }

    const failed = snapshot.status === 'failed';
    const done = settled && !failed;

    return (
        <div
            className={`mt-6 rounded-md px-3.5 py-3 portal-text-body ${
                failed ? 'bg-destructive/10 text-destructive' : done ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
            }`}
        >
            <p className="flex items-center gap-2 font-semibold">
                {failed ? <XCircle className="h-4 w-4" /> : done ? <CheckCircle2 className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                {snapshot.name}
                <span className="font-normal opacity-70">· {snapshot.status.replace(/_/g, ' ')}</span>
            </p>

            {snapshot.steps.length > 0 && (
                <ol className="mt-2.5 space-y-1 border-t border-current/10 pt-2.5 portal-text-caption">
                    {snapshot.steps.map((step) => (
                        <li key={step.id} className="flex items-start gap-2">
                            <span className="opacity-50">{step.status === 'success' ? '✓' : step.status === 'failed' ? '✗' : '•'}</span>
                            <span>
                                {step.action}
                                {step.message ? <span className="opacity-70"> — {step.message}</span> : null}
                            </span>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}
