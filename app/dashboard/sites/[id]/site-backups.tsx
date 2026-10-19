'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Download, History, LoaderCircle } from 'lucide-react';
import type { CustomerSite, SiteBackupSet, SiteBackups } from '@/lib/controller-client';
import { backupSettingsAction, restoreBackupAction } from '../../actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { FormField } from '@/components/ui/form-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const formatSize = (bytes: number) =>
    bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB`
    : bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const KIND: Record<SiteBackupSet['kind'], { label: string; variant: 'neutral' | 'info' | 'warning' }> = {
    manual: { label: 'Manual', variant: 'neutral' },
    scheduled: { label: 'Scheduled', variant: 'info' },
    safety: { label: 'Before restore', variant: 'warning' },
};

const FILE_LABEL: Record<string, string> = {
    database: 'Database', files: 'Public files', 'private-files': 'Private files', config: 'Site config', other: 'Other',
};

function Pending({ children, enabled = true, variant = 'default', size = 'sm' }: { children: React.ReactNode; enabled?: boolean; variant?: 'default' | 'outline' | 'destructive'; size?: 'sm' | 'default' }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" size={size} variant={variant} disabled={!enabled || pending}>
            {pending && <LoaderCircle className="size-4 motion-safe:animate-spin" />}
            {children}
        </Button>
    );  
}

function Schedule({ site, backups }: { site: CustomerSite; backups: SiteBackups | null }) {
    const [state, action] = useActionState(backupSettingsAction, undefined);
    const [schedule, setSchedule] = useState<string>(backups?.schedule ?? site.backup.schedule);
    const [retention, setRetention] = useState(String(backups?.retention ?? site.backup.retention));
    return (
        <form action={action} className="mt-6 rounded-lg border border-border p-4">
            <input type="hidden" name="siteId" value={site.id} />
            <input type="hidden" name="schedule" value={schedule} />
            <p className="font-medium">Automatic backups</p>
            <div className="mt-3 grid gap-gap sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                <FormField id="schedule" label="How often">
                    <Select value={schedule} onValueChange={setSchedule}>
                        <SelectTrigger id="schedule"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="off">Off</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                    </Select>
                </FormField>
                <FormField id="retention" label="Keep the latest">
                <FormField id="retention" label="Keep the latest" help="Older automatic backups are removed.">
                {/* <FormField id="retention" label="Keep the latest" help=""> */}
                    <Input id="retention" name="retention" type="number" min={1} max={30} value={retention} onChange={(e) => setRetention(e.target.value)} disabled={schedule === 'off'} />
                </FormField>
                <div><Pending variant="outline" size="default">Save</Pending></div>
            </div>
            <p className="mt-2 portal-text-caption text-muted-foreground">Older automatic backups are removed.</p>
            {state?.error && <p role="alert" className="mt-2 text-xs text-destructive">{state.error}</p>}
            {state?.success && <p className="mt-2 text-xs text-success">{state.success}</p>}
            {site.backup.last_at && (
                <p className="mt-2 portal-text-caption text-muted-foreground">Last backup: {new Date(site.backup.last_at).toLocaleString()}</p>
            )}
        </form>
    );
}

function Restore({ site, set, onDone }: { site: CustomerSite; set: SiteBackupSet; onDone: () => void }) {
    const [state, action] = useActionState(restoreBackupAction, undefined);
    const [typed, setTyped] = useState('');
    const [open, setOpen] = useState(false);
    const seen = useRef(state);
    useEffect(() => {
        if (state !== seen.current) {
            seen.current = state;
            if (state?.success) onDone();
        }
    }, [state, onDone]);
    // Once the restore is accepted the dialog is done, whatever the open flag says.
    const visible = open && !state?.success;
    const hasDatabase = set.files.some((file) => file.type === 'database');
    return (
        <AlertDialog open={visible} onOpenChange={(value) => { setOpen(value); setTyped(''); }}>
            <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" size="sm" disabled={!hasDatabase || site.status !== 'ready' || Boolean(site.activity)}>
                    <History className="size-4" />Restore
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <form action={action}>
                    <input type="hidden" name="siteId" value={site.id} />
                    <input type="hidden" name="stamp" value={set.stamp} />
                    <AlertDialogHeader>
                        <AlertDialogTitle>Restore this backup?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Everything entered since {new Date(set.created_at * 1000).toLocaleString()} is replaced by this backup, and the site is offline
                            for a few minutes. We take a safety backup first and put your current data back if the restore fails.
                            Type <strong>{site.slug}</strong> to confirm.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" aria-label="Type the site name to confirm" className="mt-4" />
                    {state?.error && <Notice tone="error" className="mt-3">{state.error}</Notice>}
                    <AlertDialogFooter className="mt-5">
                        <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                        <Pending variant="destructive" enabled={typed.trim().toLowerCase() === site.slug}>Restore backup</Pending>
                    </AlertDialogFooter>
                </form>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export function SiteBackupsPanel({ site, backups, error, onChange }: {
    site: CustomerSite; backups: SiteBackups | null; error: boolean; onChange: () => void;
}) {
    const running = site.status === 'ready';
    return (
        <>
            {!running && !['restoring', 'updating'].includes(site.status) && <Notice tone="info" className="mt-4">Start the site to create, download or restore backups.</Notice>}
            {site.status === 'restoring' && (
                <Notice tone="info" className="mt-4">
                    <span className="inline-flex items-center gap-2"><LoaderCircle className="size-4 motion-safe:animate-spin" />{site.message}</span>
                </Notice>
            )}
            {running && site.activity === 'backup' && (
                <p className="mt-4 inline-flex items-center gap-2 portal-text-body text-foreground/70">
                    <LoaderCircle className="size-4 motion-safe:animate-spin" />Creating a backup…
                </p>
            )}
            <Schedule site={site} backups={backups} />
            {running && error && <p className="mt-4 portal-text-body text-muted-foreground">Backups could not be listed right now.</p>}
            {running && backups && !error && (
                backups.results.length ? (
                    <ul className="mt-4 divide-y divide-border/60">
                        {backups.results.map((set) => (
                            <li key={set.stamp} className="py-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <span>
                                        <span className="flex items-center gap-2 portal-text-body font-medium">
                                            {new Date(set.created_at * 1000).toLocaleString()}
                                            <Badge variant={KIND[set.kind].variant}>{KIND[set.kind].label}</Badge>
                                        </span>
                                        <span className="mt-1 block portal-text-caption text-muted-foreground">{formatSize(set.size_bytes)}</span>
                                    </span>
                                    <Restore site={site} set={set} onDone={onChange} />
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {set.files.map((file) => (
                                        <Button asChild key={file.name} variant="outline" size="sm">
                                            <a href={`/api/customer/sites/${site.id}/backups/${encodeURIComponent(file.name)}`}>
                                                <Download className="size-4" />{FILE_LABEL[file.type] ?? file.type} · {formatSize(file.size_bytes)}
                                            </a>
                                        </Button>
                                    ))}
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="mt-4 portal-text-body text-muted-foreground">No backups yet.</p>
                )
            )}
        </>
    );
}
