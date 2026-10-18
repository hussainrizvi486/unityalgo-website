'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { ThemeScope } from '@/components/ui/theme-scope';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils';
import { DASHBOARD_THEME_COOKIE } from '@/lib/dashboard-theme';

const DashboardThemeContext = React.createContext<{ dark: boolean; toggle: () => void }>({ dark: false, toggle: () => {} });
export const useDashboardTheme = () => React.useContext(DashboardThemeContext);

export function DashboardRoot({
    children,
    initialDark = false,
    className,
}: {
    children: React.ReactNode;
    initialDark?: boolean;
    className?: string;
}) {
    const [dark, setDark] = React.useState(initialDark);
    const scope = dark ? 'dashboard dark' : 'dashboard';

    const toggle = React.useCallback(() => {
        setDark((current) => {
            const next = !current;
            document.cookie = `${DASHBOARD_THEME_COOKIE}=${next ? 'dark' : 'light'}; path=/; max-age=31536000; samesite=lax`;
            return next;
        });
    }, []);

    return (
        <DashboardThemeContext.Provider value={{ dark, toggle }}>
            <ThemeScope.Provider value={scope}>
                <SidebarProvider className={cn(scope, 'text-foreground', className)}>{children}</SidebarProvider>
            </ThemeScope.Provider>
        </DashboardThemeContext.Provider>
    );
}

/** Light / dark switch for the portal top bars. */
export function ThemeToggle() {
    const { dark, toggle } = useDashboardTheme();
    return (
        <Button type="button" variant="ghost" size="icon" onClick={toggle} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}>
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
    );
}
