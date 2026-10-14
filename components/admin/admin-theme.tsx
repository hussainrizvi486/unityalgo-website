'use client';

import { ThemeScope } from '@/components/ui/theme-scope';

/** Keep admin overlays on the same CSS tokens as the page that opened them. */
export function AdminTheme({ children }: { children: React.ReactNode }) {
    return <ThemeScope.Provider value="admin-portal">{children}</ThemeScope.Provider>;
}
