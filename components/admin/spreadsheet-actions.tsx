'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface ImportReport {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    errors: { line: number; message: string }[];
}

/** Export, template and import controls for an admin list backed by `/api/admin/spreadsheet/<entity>`. */
export function SpreadsheetActions({ entity, exportQuery = '', note }: {
    entity: 'leads' | 'plans';
    /** Extra query string for the export, e.g. `status=NEW`. */
    exportQuery?: string;
    /** Shown in the result dialog after a successful import. */
    note?: string;
}) {
    const router = useRouter();
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [report, setReport] = useState<ImportReport | null>(null);
    const base = `/api/admin/spreadsheet/${entity}`;

    async function upload(file: File) {
        setBusy(true);
        setError(null);
        try {
            const body = new FormData();
            body.append('file', file);
            const response = await fetch(base, { method: 'POST', body });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error ?? 'The import failed.');
            setReport(data);
            router.refresh();
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'The import failed.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <Button asChild variant="outline">
                <a href={`${base}${exportQuery ? `?${exportQuery}` : ''}`} download>
                    <Download className="size-4" />
                    Export
                </a>
            </Button>
            <Button asChild variant="ghost">
                <a href={`${base}?template=1`} download>
                    <FileSpreadsheet className="size-4" />
                    Template
                </a>
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {busy ? 'Importing…' : 'Import'}
            </Button>
            <input
                ref={input}
                type="file"
                hidden
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void upload(file);
                }}
            />

            <Dialog open={Boolean(report || error)} onOpenChange={(open) => { if (!open) { setReport(null); setError(null); } }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{error ? 'Import failed' : 'Import finished'}</DialogTitle>
                        <DialogDescription>
                            {error ?? (
                                <>
                                    {report!.total} row{report!.total === 1 ? '' : 's'} read from the file.
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    {report && (
                        <div className="space-y-4">
                            <dl className="grid grid-cols-4 gap-2 text-center">
                                {[
                                    ['Added', report.created],
                                    ['Updated', report.updated],
                                    ['Skipped', report.skipped],
                                    ['Errors', report.errors.length],
                                ].map(([name, value]) => (
                                    <div key={name} className="rounded-lg border p-2">
                                        <dd className="text-xl font-semibold">{value}</dd>
                                        <dt className="portal-text-caption text-muted-foreground">{name}</dt>
                                    </div>
                                ))}
                            </dl>
                            {report.skipped > 0 && (
                                <p className="portal-text-caption text-muted-foreground">Skipped rows already exist with the same details.</p>
                            )}
                            {report.errors.length > 0 && (
                                <div>
                                    <p className="portal-text-body font-semibold">Rows not saved</p>
                                    <ul className="mt-2 max-h-48 space-y-1 overflow-auto rounded-lg border bg-muted/40 p-3 portal-text-caption">
                                        {report.errors.slice(0, 50).map((item) => (
                                            <li key={`${item.line}-${item.message}`}>
                                                <span className="font-semibold">Row {item.line}:</span> {item.message}
                                            </li>
                                        ))}
                                        {report.errors.length > 50 && <li>…and {report.errors.length - 50} more.</li>}
                                    </ul>
                                </div>
                            )}
                            {note && report.updated + report.created > 0 && (
                                <p className="portal-text-caption text-muted-foreground">{note}</p>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="button" onClick={() => { setReport(null); setError(null); }}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
