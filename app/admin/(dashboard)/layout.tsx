import { cookies } from 'next/headers';
import { SidebarInset } from '@/components/ui/sidebar';
import { DashboardRoot } from '@/components/ui/dashboard-root';
import { DASHBOARD_THEME_COOKIE } from '@/lib/dashboard-theme';
import { requireAdmin } from '@/lib/admin-session';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminTopbar } from '@/components/admin/admin-topbar';
import '@/app/dashboard/portal.css';

/**
 * The admin shell: a floating nav card and a content card on a shared ground.
 *
 * `SidebarProvider` carries the open/collapsed state, persists it to a cookie
 * so a reload does not reset it, and owns the ⌘B shortcut and the mobile
 * drawer. The ground colour lives here rather than on the sidebar, because in
 * this layout both panels float on it.
 */
export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
    const admin = await requireAdmin();
    const dark = (await cookies()).get(DASHBOARD_THEME_COOKIE)?.value === 'dark';
    const name = [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.name || admin.email;
    return (
        <DashboardRoot initialDark={dark} className="bg-secondary">
            <AdminSidebar user={{ name, email: admin.email }} />
            <SidebarInset className="min-w-0 rounded-xl border border-border/70 bg-card shadow-sm">
                <AdminTopbar />
                <div className="portal-content">{children}</div>
            </SidebarInset>
        </DashboardRoot>
    );
}
