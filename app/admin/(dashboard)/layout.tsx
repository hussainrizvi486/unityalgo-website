import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminBreadcrumbs } from '@/components/admin/admin-breadcrumbs';

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-ink-50 flex">
            <AdminSidebar />
            <main className="flex-1 min-w-0 px-8 py-8">
                <AdminBreadcrumbs />
                {children}
            </main>
        </div>
    );
}
