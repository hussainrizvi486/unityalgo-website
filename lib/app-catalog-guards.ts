import 'server-only';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { controller } from '@/lib/controller-client';

/**
 * Why an entry's type cannot be changed right now, or null when it can. Switching an entry that sites already have would
 * leave those sites with a record the new type cannot understand.
 */
export async function typeChangeProblem(app: { id: string; appType: string; frappeAppName: string | null }, nextType: string) {
    if (app.appType === nextType) return null;
    if (app.appType === 'module') {
        const sites = await db.$count(schema.siteModuleApp, eq(schema.siteModuleApp.appId, app.id));
        return sites > 0 ? `It is switched on for ${sites} site${sites === 1 ? '' : 's'}, so it cannot become an application. Hide it instead, or create a new entry.` : null;
    }
    if (app.frappeAppName) {
        try {
            const sites = (await controller.apps.summary()).results[app.frappeAppName]?.sites ?? 0;
            if (sites > 0) return `It is installed on ${sites} site${sites === 1 ? '' : 's'}, so it cannot become a module. Hide it instead, or create a new entry.`;
        } catch {
            return 'Could not check whether any site has this application installed. Try again in a moment.';
        }
    }
    return null;
}
