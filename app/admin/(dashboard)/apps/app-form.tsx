'use client';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveAppCatalogAction } from '@/app/admin/app-catalog-actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { CoverImageField } from '@/components/admin/cover-image-field';
type App = {
    id: string;
    name: string;
    slug: string;
    description: string;
    category: string;
    iconUrl: string | null;
    minPlanId: string | null;
    appType: string;
    modules: string[];
    frappeAppName: string | null;
    isActive: boolean;
    isInstallable: boolean;
};
function Save() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save application'}
        </Button>
    );
}
export function AppCatalogForm({ app, github = false, plans = [] }: { app?: App; github?: boolean; plans?: { id: string; name: string }[] }) {
    const [state, action] = useActionState(saveAppCatalogAction, undefined);
    const prefix = app?.id || 'new';
    const [appType, setAppType] = useState<'application' | 'module'>(app?.appType === 'module' ? 'module' : 'application');
    const isModule = !github && appType === 'module';
    return (
        <form action={action} className="portal-fields py-5">
            <input type="hidden" name="id" value={app?.id || ''} />
            {github && <input type="hidden" name="frappeAppName" value={app?.frappeAppName || ''} />}
            {github && <input type="hidden" name="appType" value="application" />}
            {}
            {github && app?.isInstallable && <input type="hidden" name="isInstallable" value="on" />}
            {!github && (
                <div>
                    <Label htmlFor={`${prefix}-appType`}>Application type</Label>
                    <select
                        id={`${prefix}-appType`} name="appType" value={appType} onChange={(event) => setAppType(event.target.value as 'application' | 'module')}
                        className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 portal-text-body"
                    >
                        <option value="application">Application: installs a Frappe app on the site</option>
                        <option value="module">Module: switches on modules only, installs nothing</option>
                    </select>
                </div>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
                {[
                    ['name', 'Name'],
                    ['slug', 'Slug'],
                    ['category', 'Category'],
                    ...(github || isModule ? [] : [['frappeAppName', 'Frappe application name']]),
                ].map(([field, label]) => (
                    <div key={field}>
                        <Label htmlFor={`${prefix}-${field}`}>{label}</Label>
                        <Input
                            id={`${prefix}-${field}`}
                            name={field}
                            defaultValue={String(
                                app?.[field as keyof App] || '',
                            )}
                            required={field !== 'frappeAppName'}
                            className="mt-2"
                        />
                    </div>
                ))}
            </div>
            <div>
                <Label>Icon</Label>
                <p className="portal-text-caption text-muted-foreground">Shown on the App Store card. Square images work best.</p>
                <div className="mt-2">
                    <CoverImageField name="iconUrl" defaultValue={app?.iconUrl ?? ''} />
                </div>
            </div>
            {isModule && (
                <div>
                    <Label htmlFor={`${prefix}-modules`}>Modules</Label>
                    <p className="portal-text-caption text-muted-foreground">
                        The Frappe module names this entry covers, one per line (for example Manufacturing). Installing it on a site assigns these modules to the
                        site&apos;s &quot;Subscription&quot; domain and makes that the active domain; no app is installed. A name the site does not have is reported and skipped.
                    </p>
                    <Textarea id={`${prefix}-modules`} name="modules" defaultValue={app?.modules?.join('\n') ?? ''} rows={5} className="mt-2 font-mono" />
                </div>
            )}
            <div>
                <Label htmlFor={`${prefix}-minPlanId`}>Works on plans from</Label>
                <p className="portal-text-caption text-muted-foreground">The lowest plan that supports this app. Customers on a lower plan are asked to upgrade first.</p>
                <select
                    id={`${prefix}-minPlanId`} name="minPlanId" defaultValue={app?.minPlanId ?? ''}
                    className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 portal-text-body"
                >
                    <option value="">Every plan</option>
                    {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} and above</option>)}
                </select>
            </div>
            <div>
                <Label htmlFor={`${prefix}-description`}>Description</Label>
                <Textarea
                    id={`${prefix}-description`}
                    name="description"
                    defaultValue={app?.description}
                    required
                    maxLength={2000}
                    className="mt-2"
                />
            </div>
            <label className="flex items-center gap-2 portal-text-body">
                <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={app?.isActive ?? true}
                />
                Visible in App Store
            </label>
            {!github && (
                <>
                    <label className="flex items-center gap-2 portal-text-body">
                        <input
                            type="checkbox"
                            name="isInstallable"
                            defaultChecked={app?.isInstallable ?? false}
                        />
                        Enable installation
                    </label>
                    {!isModule && (
                        <p className="portal-text-caption leading-6 text-muted-foreground">
                            Before enabling installation, include this package in
                            FRAPPE_IMAGE and FRAPPE_AVAILABLE_APPS on the controller. Only
                            packages in the image can be installed.
                        </p>
                    )}
                </>
            )}
            {state?.error && <Notice tone="error">{state.error}</Notice>}
            {state?.success && <Notice tone="success">{state.success}</Notice>}
            <Save />
        </form>
    );
}
