import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';

interface AdminPageHeaderProps {
    title: string;
    /** Short line under the title — usually a count. */
    subtitle?: React.ReactNode;
    /** The page's primary call to action. */
    action?: { label: string; href: string };
    /** Extra controls placed left of the primary action. */
    children?: React.ReactNode;
}

/**
 * The title block every admin list page opens with.
 *
 * Server component: it renders no interactive state of its own, so pages keep
 * it outside the client boundary drawn by AdminListView.
 */
export function AdminPageHeader({ title, subtitle, action, children }: AdminPageHeaderProps) {
    return (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
                {subtitle != null && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2">
                {children}
                {action && (
                    <Link href={action.href}>
                        <Button className="bg-ink-900 text-white hover:bg-ink-800">
                            {action.label}
                        </Button>
                    </Link>
                )}
            </div>
        </div>
    );
}

/** Inline error banner, styled once so every list reports failures the same way. */
export function AdminPageError({ message }: { message: string }) {
    return <Notice tone="error" className="mb-6">{message}</Notice>;
}

/** Inline success banner, the counterpart to AdminPageError. */
export function AdminPageNotice({ message }: { message: string }) {
    return <Notice tone="success" className="mb-6">{message}</Notice>;
}
