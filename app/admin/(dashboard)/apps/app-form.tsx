'use client';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveAppCatalogAction } from '@/app/admin/app-catalog-actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
type App = {
    id: string;
    name: string;
    slug: string;
    description: string;
    category: string;
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
/** `github` apps are installed per site by rollouts, so the image-only fields are hidden and kept as they are. */
export function AppCatalogForm({ app, github = false }: { app?: App; github?: boolean }) {
    const [state, action] = useActionState(saveAppCatalogAction, undefined);
    const prefix = app?.id || 'new';
    return (
        <form action={action} className="portal-fields py-5">
            <input type="hidden" name="id" value={app?.id || ''} />
            {github && <input type="hidden" name="frappeAppName" value={app?.frappeAppName || ''} />}
            <div className="grid gap-5 sm:grid-cols-2">
                {[
                    ['name', 'Name'],
                    ['slug', 'Slug'],
                    ['category', 'Category'],
                    ...(github ? [] : [['frappeAppName', 'Frappe application name']]),
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
                    <p className="portal-text-caption leading-6 text-muted-foreground">
                        Before enabling installation, include this package in
                        FRAPPE_IMAGE and FRAPPE_AVAILABLE_APPS on the controller. Only
                        packages in the image can be installed.
                    </p>
                </>
            )}
            {state?.error && <Notice tone="error">{state.error}</Notice>}
            {state?.success && <Notice tone="success">{state.success}</Notice>}
            <Save />
        </form>
    );
}
