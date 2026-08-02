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

const SECTION_LABELS: Record<string, string> = {
    blogs: 'Blogs',
    contacts: 'Contacts',
    users: 'Users',
};

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
        <Breadcrumb className="mb-6">
            <BreadcrumbList>
                <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                        <Link href="/admin/blogs">Admin</Link>
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
