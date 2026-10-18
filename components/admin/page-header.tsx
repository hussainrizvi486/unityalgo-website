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

export function AdminPageHeader({ title, subtitle, action, children }: AdminPageHeaderProps) {
    return (
        <div className="portal-page-header">
            <div>
                <h1 className="portal-page-title">{title}</h1>
                {subtitle != null && <p className="mt-1 portal-text-body text-muted-foreground">{subtitle}</p>}
            </div>
            <div className="portal-actions">
                {children}
                {action && (
                    <Button asChild>
                        <Link href={action.href}>{action.label}</Link>
                    </Button>
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
