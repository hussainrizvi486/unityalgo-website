import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminTopbar } from '@/components/admin/admin-topbar';

/**
 * The admin shell: a floating nav card and a content card on a shared ground.
 *
 * `SidebarProvider` carries the open/collapsed state, persists it to a cookie
 * so a reload does not reset it, and owns the ⌘B shortcut and the mobile
 * drawer. The ground colour lives here rather than on the sidebar, because in
 * this layout both panels float on it.
 */
export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider className="bg-ink-100" style={{ '--sidebar-width': '15rem' } as React.CSSProperties}>
            <AdminSidebar />
            {/* <SidebarInset className="m-3 ml-0 min-w-0 rounded-xl border border-ink-200/70 bg-white shadow-sm"> */}
            <SidebarInset className="min-w-0 rounded-xl border border-ink-200/70 bg-white shadow-sm">
                <AdminTopbar />
                <div className="min-w-0 flex-1 px-6 py-6">{children}</div>
            </SidebarInset>
        </SidebarProvider>
    );
}
