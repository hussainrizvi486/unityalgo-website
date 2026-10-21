import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils';

/** Pulsing placeholders that mirror the real page layouts while data loads. */

function Heading({ withAction = false }: { withAction?: boolean }) {
    return (
        <div className="mb-gap flex items-center justify-between gap-gap">
            <div className="space-y-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-72 max-w-full" />
            </div>
            {withAction && <Skeleton className="h-10 w-32 rounded-lg" />}
        </div>
    );
}

function StatCard() {
    return (
        <div className="p-5 portal-surface">
            <div className="flex items-start justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="size-10 rounded-xl" />
            </div>
            <Skeleton className="mt-5 h-8 w-24" />
            <Skeleton className="mt-2 h-3 w-32" />
        </div>
    );
}

export function DashboardSkeleton() {
    return (
        <div className="portal-page" role="status" aria-busy="true" aria-label="Loading dashboard">
            <div className="rounded-2xl border border-border p-5 sm:p-8">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="mt-4 h-9 w-64" />
                <Skeleton className="mt-3 h-4 w-80 max-w-full" />
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Skeleton className="h-10 w-full rounded-lg sm:w-40" />
                    <Skeleton className="h-10 w-full rounded-lg sm:w-40" />
                </div>
            </div>
            <div className="mt-gap grid gap-gap sm:grid-cols-2 lg:grid-cols-3">
                <StatCard />
                <StatCard />
                <StatCard />
            </div>
            <Skeleton className="mt-gap h-56 rounded-2xl" />
        </div>
    );
}

export function CardGridSkeleton({ count = 8, withToolbar = true }: { count?: number; withToolbar?: boolean }) {
    return (
        <div className="portal-page" role="status" aria-busy="true" aria-label="Loading">
            {withToolbar && (
                <div className="flex flex-col justify-between gap-gap lg:flex-row lg:items-center">
                    <div className="flex gap-2">
                        {[16, 20, 14, 18].map((width, index) => (
                            <Skeleton key={index} className="h-9 rounded-full" style={{ width: `${width * 4}px` }} />
                        ))}
                    </div>
                    <Skeleton className="h-10 w-full rounded-lg lg:max-w-xs" />
                </div>
            )}
            <div className="mt-gap grid gap-2 md:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: count }, (_, index) => (
                    <div key={index} className="overflow-hidden rounded-2xl border bg-card">
                        <div className="p-card">
                            <div className="flex items-center gap-2">
                                <Skeleton className="size-11 rounded-xl" />
                                <Skeleton className="h-5 w-28" />
                            </div>
                            <Skeleton className="mt-4 h-3 w-full" />
                            <Skeleton className="mt-2 h-3 w-5/6" />
                            <Skeleton className="mt-2 h-3 w-2/3" />
                        </div>
                        <div className="flex items-center justify-between border-t bg-muted/50 px-card py-3">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-8 w-20 rounded-lg" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function ListSkeleton({ rows = 6, withAction = true }: { rows?: number; withAction?: boolean }) {
    return (
        <div className="portal-page" role="status" aria-busy="true" aria-label="Loading">
            <Heading withAction={withAction} />
            <div className="overflow-hidden portal-surface">
                {Array.from({ length: rows }, (_, index) => (
                    <div key={index} className="flex items-center gap-gap border-b border-border/60 p-4 last:border-0">
                        <Skeleton className="size-10 shrink-0 rounded-lg" />
                        <div className="min-w-0 flex-1 space-y-2">
                            <Skeleton className="h-4 w-1/3" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                        <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function DetailSkeleton({ className }: { className?: string }) {
    return (
        <div className={cn('portal-detail', className)} role="status" aria-busy="true" aria-label="Loading">
            <Skeleton className="mb-6 h-4 w-32" />
            <div className="flex flex-wrap items-center gap-3">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-4 w-80 max-w-full" />
            <div className="mt-8 grid gap-gap sm:grid-cols-3">
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
            </div>
            <Skeleton className="mt-gap h-64 rounded-xl" />
        </div>
    );
}

export function FormSkeleton() {
    return (
        <div className="portal-page" role="status" aria-busy="true" aria-label="Loading">
            <Heading />
            <div className="space-y-5 p-5 portal-surface">
                {Array.from({ length: 4 }, (_, index) => (
                    <div key={index} className="space-y-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                ))}
                <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
        </div>
    );
}
