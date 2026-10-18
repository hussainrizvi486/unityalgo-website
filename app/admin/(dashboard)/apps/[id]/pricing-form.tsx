'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveAppPricingAction, syncAppPricingAction } from '@/app/admin/app-store-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';

function Submit({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'outline' }) {
    const { pending } = useFormStatus();
    return <Button type="submit" variant={variant} disabled={pending}>{pending ? 'Working…' : children}</Button>;
}

export function PricingForm({
    id, price, currency, paddlePriceId, installable, github, billing,
}: {
    id: string;
    price: number | null;
    currency: string;
    paddlePriceId: string | null;
    installable: boolean;
    github: boolean;
    billing: 'paddle' | 'test' | null;
}) {
    const [saved, save] = useActionState(saveAppPricingAction, undefined);
    const [synced, sync] = useActionState(syncAppPricingAction, undefined);
    const paid = (price ?? 0) > 0;
    return (
        <div className="space-y-gap">
            <form action={save} className="portal-fields">
                <input type="hidden" name="id" value={id} />
                <label className="flex items-center gap-2 portal-text-body">
                    <input type="checkbox" name="isInstallable" defaultChecked={installable} />
                    {github ? 'Customers can install this app on their sites' : 'Customers can install this app'}
                </label>
                <div className="max-w-xs">
                    <Label htmlFor="priceAmount">Price per site, per month ({currency})</Label>
                    <Input id="priceAmount" name="priceAmount" type="number" min="0" step="0.01" defaultValue={price ?? ''} placeholder="Free" className="mt-2" />
                    <p className="mt-1 portal-text-caption text-muted-foreground">Leave blank or 0 for a free app.</p>
                </div>
                {saved?.error && <Notice tone="error">{saved.error}</Notice>}
                {saved?.success && <Notice tone="success">{saved.success}</Notice>}
                <Submit>Save</Submit>
            </form>

            {paid && (
                <form action={sync} className="rounded-lg border bg-muted/40 p-card">
                    <input type="hidden" name="id" value={id} />
                    <p className="portal-text-body font-medium">Billing</p>
                    <p className="mt-1 portal-text-caption text-muted-foreground">
                        {paddlePriceId ? <>Paddle price <code>{paddlePriceId}</code>. Syncing pushes the price above to it; it changes what existing buyers are charged at their next renewal.</>
                            : 'No Paddle price yet. Customers cannot buy this app until one is created.'}
                    </p>
                    {billing === null && <Notice tone="warning" className="mt-3">Billing is not configured on this server (no PADDLE_API_KEY), so paid apps cannot be bought.</Notice>}
                    {billing === 'test' && <Notice tone="info" className="mt-3">Test billing is on (APP_BILLING_MODE=test): purchases are recorded but nobody is charged.</Notice>}
                    {synced?.error && <Notice tone="error" className="mt-3">{synced.error}</Notice>}
                    {synced?.success && <Notice tone="success" className="mt-3">{synced.success}</Notice>}
                    <div className="mt-3"><Submit variant="outline">{paddlePriceId ? 'Sync price to Paddle' : 'Create price in Paddle'}</Submit></div>
                </form>
            )}
        </div>
    );
}
