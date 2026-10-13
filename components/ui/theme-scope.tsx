'use client';

import { createContext, useContext } from 'react';

// Carry an opt-in theme through Radix portals rendered outside the page shell.
export const ThemeScope = createContext<string | undefined>(undefined);
export function useThemeScope() {
    return useContext(ThemeScope);
}
