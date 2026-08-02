import Link from 'next/link';
import { cn } from '@/utils';

interface AdminPaginationProps {
    basePath: string;
    currentPage: number;
    totalPages: number;
    searchParams?: Record<string, string | undefined>;
}

function buildHref(basePath: string, page: number, searchParams?: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams ?? {})) {
        if (value) params.set(key, value);
    }
    if (page > 1) params.set('page', String(page));
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
}

export function AdminPagination({ basePath, currentPage, totalPages, searchParams }: AdminPaginationProps) {
    if (totalPages <= 1) return null;

    const windowStart = Math.max(1, currentPage - 2);
    const windowEnd = Math.min(totalPages, currentPage + 2);
    const pages = Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => windowStart + i);

    return (
        <div className="flex items-center justify-center gap-2 mt-8">
            <Link
                href={buildHref(basePath, Math.max(1, currentPage - 1), searchParams)}
                aria-disabled={currentPage === 1}
                className={cn(
                    'px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    currentPage === 1 ? 'text-ink-300 pointer-events-none' : 'text-ink-600 hover:bg-ink-100'
                )}
            >
                Prev
            </Link>

            {windowStart > 1 && (
                <>
                    <Link href={buildHref(basePath, 1, searchParams)} className="w-9 h-9 flex items-center justify-center rounded-lg text-sm text-ink-600 hover:bg-ink-100">
                        1
                    </Link>
                    {windowStart > 2 && <span className="text-ink-400 px-1">…</span>}
                </>
            )}

            {pages.map((page) => (
                <Link
                    key={page}
                    href={buildHref(basePath, page, searchParams)}
                    className={cn(
                        'w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors',
                        page === currentPage ? 'bg-brand text-white' : 'text-ink-600 hover:bg-ink-100'
                    )}
                >
                    {page}
                </Link>
            ))}

            {windowEnd < totalPages && (
                <>
                    {windowEnd < totalPages - 1 && <span className="text-ink-400 px-1">…</span>}
                    <Link href={buildHref(basePath, totalPages, searchParams)} className="w-9 h-9 flex items-center justify-center rounded-lg text-sm text-ink-600 hover:bg-ink-100">
                        {totalPages}
                    </Link>
                </>
            )}

            <Link
                href={buildHref(basePath, Math.min(totalPages, currentPage + 1), searchParams)}
                aria-disabled={currentPage === totalPages}
                className={cn(
                    'px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    currentPage === totalPages ? 'text-ink-300 pointer-events-none' : 'text-ink-600 hover:bg-ink-100'
                )}
            >
                Next
            </Link>
        </div>
    );
}
