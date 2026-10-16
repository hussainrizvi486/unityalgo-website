import type { Compatibility, RolloutSiteStatus, RolloutStatus } from '@/lib/controller-client';

type Variant = 'neutral' | 'success' | 'info' | 'warning' | 'error';

export const shortSha = (sha?: string | null) => (sha ? sha.slice(0, 8) : '—');

/** "15.1.0 · a1b2c3d4", or whichever half is known. */
export function versionLabel(version?: string | null, commit?: string | null) {
    if (version && commit) return `${version} · ${shortSha(commit)}`;
    return version ?? (commit ? shortSha(commit) : 'Unknown');
}

export function repoPath(url?: string | null) {
    return url ? url.replace('https://github.com/', '') : '';
}

export function compatibilityBadge(status?: string | null): { label: string; variant: Variant } {
    const value = status as Compatibility | null | undefined;
    if (value === 'compatible') return { label: 'Compatible', variant: 'success' };
    if (value === 'incompatible') return { label: 'Incompatible', variant: 'error' };
    if (value === 'unknown') return { label: 'Unverified', variant: 'warning' };
    return { label: 'Not checked', variant: 'neutral' };
}

export function rolloutBadge(status: RolloutStatus): { label: string; variant: Variant } {
    return {
        running: { label: 'In progress', variant: 'info' as const },
        completed: { label: 'Completed', variant: 'success' as const },
        partial: { label: 'Partly failed', variant: 'warning' as const },
        failed: { label: 'Failed', variant: 'error' as const },
    }[status];
}

export function rolloutSiteBadge(status: RolloutSiteStatus): { label: string; variant: Variant } {
    return {
        pending: { label: 'Waiting', variant: 'neutral' as const },
        running: { label: 'Updating', variant: 'info' as const },
        success: { label: 'Done', variant: 'success' as const },
        failed: { label: 'Failed', variant: 'error' as const },
        skipped: { label: 'Skipped', variant: 'warning' as const },
    }[status];
}

/** The one-paragraph answer to "does updating an app touch other sites?", shown wherever a rollout is started or watched. */
export const ISOLATION_NOTE =
    'Every customer site runs in its own isolated stack with its own copy of the application code. '
    + 'An update builds a new image for each selected site only, then runs that site’s database migration inside its own stack. '
    + 'Other sites keep their code and data. Before anything changes, a safety backup is taken, and a failed update is rolled back automatically.';
