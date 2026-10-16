'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Trash2 } from 'lucide-react';
import type { CustomerSite } from '@/lib/controller-client';
import { deleteSiteAction } from '../../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import {
    AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

function ConfirmButton({ enabled }: { enabled: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" variant="destructive" size="sm" disabled={!enabled || pending}>
            {pending ? <LoaderCircle className="size-4 motion-safe:animate-spin" /> : <Trash2 className="size-4" />}
            Delete permanently
        </Button>
    );
}

/** Permanent deletion, behind a dialog that requires typing the site name. */
export function DeleteSite({ site, onDone }: { site: CustomerSite; onDone: () => void }) {
    const [state, action] = useActionState(deleteSiteAction, undefined);
    const [typed, setTyped] = useState('');
    const seen = useRef(state);
    useEffect(() => {
        if (state !== seen.current) {
            seen.current = state;
            if (state?.success) onDone();
        }
    }, [state, onDone]);
    const allowed = ['ready', 'stopped', 'deactivated', 'failed'].includes(site.status) && !site.activity;
    return (
        <section className="rounded-xl border border-destructive/30 p-card">
            <h2 className="">Danger zone</h2>
            <p className="mt-1 portal-text-caption text-muted-foreground">
                Deleting removes the site, its database, files and backups. This cannot be undone.
            </p>
            <AlertDialog onOpenChange={() => setTyped('')}>
                <AlertDialogTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="mt-4 text-destructive" disabled={!allowed}>
                        <Trash2 className="size-4" />Delete site
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <form action={action}>
                        <input type="hidden" name="siteId" value={site.id} />
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete {site.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Everyone loses access immediately and the data is erased. Download any backups you want to keep first.
                                Type <strong>{site.slug}</strong> to confirm.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <Input
                            name="confirm" value={typed} onChange={(event) => setTyped(event.target.value)}
                            autoComplete="off" aria-label="Type the site name to confirm" className="mt-4"
                        />
                        {state?.error && <Notice tone="error" className="mt-3">{state.error}</Notice>}
                        <AlertDialogFooter className="mt-5">
                            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                            <ConfirmButton enabled={typed.trim().toLowerCase() === site.slug} />
                        </AlertDialogFooter>
                    </form>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    );
}
