import { AdminSidebar } from '@/components/admin/admin-sidebar';

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-gray-50 flex">
            <AdminSidebar />
            <main className="flex-1 min-w-0 px-8 py-8">{children}</main>
        </div>
    );
}
