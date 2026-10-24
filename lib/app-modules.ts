/** Module-type catalog entries: they install no app, they switch on Frappe modules for a site. Pure helpers, no server access. */

export const APP_TYPES = ['application', 'module'] as const;
export type AppType = (typeof APP_TYPES)[number];

/** The same rule the controller enforces on every module name it is asked to apply. */
export const MODULE_NAME = /^[A-Za-z0-9][A-Za-z0-9 _&.,'()/-]{0,59}$/;
export const MAX_MODULES = 100;

/** Module names typed one per line (or separated by commas): trimmed, de-duplicated, validated. */
export function parseModuleList(text: string): { modules: string[]; error?: string } {
    const modules: string[] = [];
    for (const raw of text.split(/[\n,]+/)) {
        const name = raw.trim().replace(/\s+/g, ' ');
        if (!name) continue;
        if (!MODULE_NAME.test(name)) return { modules: [], error: `"${name}" is not a valid module name. Use letters, numbers, spaces and - _ & . ( ) only, up to 60 characters.` };
        if (!modules.includes(name)) modules.push(name);
    }
    if (modules.length > MAX_MODULES) return { modules: [], error: `Add at most ${MAX_MODULES} modules.` };
    return { modules };
}

/** How an installed entry is recognised on a site: a Frappe app by its name, a module entry by its id. */
export const moduleKey = (appId: string) => `module:${appId}`;
export const installKeyFor = (app: { appType: string; id: string; frappeAppName: string | null }) =>
    app.appType === 'module' ? moduleKey(app.id) : app.frappeAppName ?? '';

/** Every module any of the lists switches on, once, in first-seen order. */
export function unionModules(lists: string[][]) {
    const all: string[] = [];
    for (const list of lists) for (const name of list) if (!all.includes(name)) all.push(name);
    return all;
}
