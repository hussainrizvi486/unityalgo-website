'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { removeAppAction } from '@/app/dashboard/app-store/actions';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { formatPrice } from '@/lib/admin-format';

/** Remove an installed app from the site, after saying what that does. A paid app stops being billed once it is gone. */
export function RemoveAppButton({
    appId, siteId, name, priceAmount, priceCurrency, disabled,
}: {
    appId: string;
    siteId: string;
    name: string;
    priceAmount: number | null;
    priceCurrency: string;
    disabled?: boolean;
}) {
    const [error, setError] = React.useState('');
    const [pending, startTransition] = React.useTransition();
    const [open, setOpen] = React.useState(false);
    const paid = (priceAmount ?? 0) > 0;

    return (
        <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
            <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={disabled}><Trash2 className="size-4" />Remove</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-2">
                            <p>
                                {name}&rsquo;s data on this site is deleted. A backup is taken first and kept, so it can be restored from the Backups tab.
                                The site is unavailable for a short time.
                            </p>
                            {paid && <p>You will stop being charged {formatPrice(priceAmount!, priceCurrency)} a month for it once it has been removed.</p>}
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {error && <Notice tone="error">{error}</Notice>}
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
                    <AlertDialogAction
                        asChild
                    >
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={pending}
                            onClick={(event) => {
                                event.preventDefault();     // stay open until the server answers, so an error can be shown
                                setError('');
                                startTransition(async () => {
                                    const result = await removeAppAction({ appId, siteId });
                                    if (result.error) setError(result.error);
                                    else setOpen(false);
                                });
                            }}
                        >
                            {pending ? 'Removing…' : 'Remove app'}
                        </Button>
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
