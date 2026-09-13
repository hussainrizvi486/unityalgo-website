'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { adminNavItems } from '@/components/admin/admin-sidebar';

/**
 * Section names come from the sidebar, so a new nav entry is labelled here
 * without a second edit. This map only covers the handful whose breadcrumb
 * label differs from their nav label.
 */
const SECTION_LABELS: Record<string, string> = Object.fromEntries(
    adminNavItems.map((item) => [item.href.replace('/admin/', ''), item.name]),
);

const NEW_LABELS: Record<string, string> = {
    blogs: 'New Post',
    contacts: 'New Contact',
    users: 'New User',
};

const EDIT_LABELS: Record<string, string> = {
    blogs: 'Edit Post',
    contacts: 'Edit Contact',
    users: 'Edit User',
};

export function AdminBreadcrumbs() {
    const pathname = usePathname();
    const segments = pathname.split('/').filter((segment) => segment && segment !== 'admin');
    const [section, ...rest] = segments;

    if (!section) return null;

    const sectionLabel = SECTION_LABELS[section] ?? section;
    const sectionHref = `/admin/${section}`;

    let leaf: string | null = null;
    if (rest[0] === 'new') {
        leaf = NEW_LABELS[section] ?? 'New';
    } else if (rest.includes('edit')) {
        leaf = EDIT_LABELS[section] ?? 'Edit';
    }

    return (
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                        <Link href="/admin">Admin</Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    {leaf ? (
                        <BreadcrumbLink asChild>
                            <Link href={sectionHref}>{sectionLabel}</Link>
                        </BreadcrumbLink>
                    ) : (
                        <BreadcrumbPage>{sectionLabel}</BreadcrumbPage>
                    )}
                </BreadcrumbItem>
                {leaf && (
                    <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>{leaf}</BreadcrumbPage>
                        </BreadcrumbItem>
                    </>
                )}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
