'use client';

import { Notice } from '@/components/ui/notice';
import * as React from 'react';
import {
    AlertTriangle, Database, KeyRound, Link2, Loader2, Lock, Play, Search, Table2, Unlock,
} from 'lucide-react';
import type { DbQueryResult, DbSchema, DbTable } from '@/lib/controller-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/utils';

/**
 * Schema browser, data browser and SQL console over one connection.
 *
 * The read/write decision is not made here. `allowWrites` only changes what the
 * UI says; the controller enforces it with a Postgres READ ONLY transaction, so
 * a statement typed into the console is refused by the engine regardless of
 * what this component believes.
 */

type Tab = 'data' | 'structure' | 'sql';

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
    return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/** Postgres folds unquoted identifiers to lower case, so anything with an
 *  upper-case letter or a dot has to be quoted to be addressable. */
function quoteIdent(name: string) {
    return /^[a-z_][a-z0-9_]*$/.test(name) ? name : `"${name.replace(/"/g, '""')}"`;
}

function qualified(table: DbTable) {
    return `${quoteIdent(table.schema)}.${quoteIdent(table.name)}`;
}

function ResultGrid({ result }: { result: DbQueryResult }) {
    if (result.kind === 'status') {
        return (
            <div className="rounded-md border border-ink-200 bg-ink-50 px-4 py-3 portal-text-body text-ink-700">
                {result.affected_rows} row{result.affected_rows === 1 ? '' : 's'} affected
                <span className="ml-2 text-ink-400">· {result.duration_ms} ms</span>
            </div>
        );
    }

    if (result.row_count === 0) {
        return (
            <div className="rounded-md border border-ink-200 bg-ink-50 px-4 py-3 portal-text-body text-ink-500">
                No rows · {result.duration_ms} ms
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center gap-2 pb-2 portal-text-caption text-ink-500">
                <span>{result.row_count} row{result.row_count === 1 ? '' : 's'}</span>
                <span>· {result.duration_ms} ms</span>
                {result.truncated ? (
                    <span className="inline-flex items-center gap-1 rounded bg-warning-50 px-1.5 py-0.5 text-warning-700">
                        <AlertTriangle className="h-3 w-3" />
                        truncated — add a LIMIT to see a specific slice
                    </span>
                ) : null}
            </div>
            {/* The grid scrolls in its own box: a wide result must never make
                the whole admin page scroll sideways. */}
            <div className="max-h-[26rem] overflow-auto rounded-md border border-ink-200">
                <table className="w-full border-collapse text-left portal-text-caption">
                    <thead className="sticky top-0 bg-ink-50">
                        <tr>
                            {result.columns.map((c) => (
                                <th key={c} className="whitespace-nowrap border-b border-ink-200 px-3 py-2 font-semibold text-ink-700">
                                    {c}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="font-mono">
                        {result.rows.map((row, i) => (
                            <tr key={i} className="even:bg-ink-50/60">
                                {row.map((cell, j) => (
                                    <td key={j} className="max-w-xs truncate border-b border-ink-100 px-3 py-1.5 text-ink-800">
                                        {cell === null
                                            ? <span className="italic text-ink-400">null</span>
                                            : String(cell)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function DatabaseBrowser({
    connectionId,
    connectionName,
    databaseName,
    allowWrites,
    schema,
    runQuery,
}: {
    connectionId: string;
    connectionName: string;
    databaseName: string;
    allowWrites: boolean;
    schema: DbSchema | null;
    runQuery: (connectionId: string, sql: string) => Promise<{ result?: DbQueryResult; error?: string }>;
}) {
    const tables = React.useMemo(() => schema?.tables ?? [], [schema]);
    const [selected, setSelected] = React.useState<DbTable | null>(tables[0] ?? null);
    const [tab, setTab] = React.useState<Tab>('data');
    const [filter, setFilter] = React.useState('');
    // Seeded from the first table rather than run on mount: opening the page
    // should not silently issue a query against someone's production database.
    const [sql, setSql] = React.useState(
        () => (tables[0] ? `SELECT * FROM ${qualified(tables[0])} LIMIT 100` : ''),
    );
    const [result, setResult] = React.useState<DbQueryResult | null>(null);
    const [error, setError] = React.useState('');
    const [running, setRunning] = React.useState(false);
    const searchRef = React.useRef<HTMLInputElement>(null);

    const visible = React.useMemo(() => {
        const needle = filter.trim().toLowerCase();
        if (!needle) return tables;
        return tables.filter((t) => `${t.schema}.${t.name}`.toLowerCase().includes(needle));
    }, [tables, filter]);

    // Cmd/Ctrl+K focuses the table search, matching what db-ui does and what a
    // keyboard-driven admin expects.
    React.useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                searchRef.current?.focus();
                searchRef.current?.select();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const execute = React.useCallback(async (statement: string) => {
        setRunning(true);
        setError('');
        try {
            const response = await runQuery(connectionId, statement);
            if (response.error) { setError(response.error); setResult(null); }
            else { setResult(response.result ?? null); }
        } finally {
            setRunning(false);
        }
    }, [connectionId, runQuery]);

    /** Opens a table's rows. Ordering is left to the server so the query stays
     *  cheap on a table with no useful default sort. */
    const openTable = React.useCallback((table: DbTable) => {
        setSelected(table);
        setTab('data');
        setSql(`SELECT * FROM ${qualified(table)} LIMIT 100`);
        setResult(null);
        setError('');
    }, []);

    return (
        <div className="flex min-h-[34rem] gap-4">
            <aside className="w-72 shrink-0 portal-surface">
                <div className="border-b border-ink-200 p-3">
                    <div className="mb-2 flex items-center gap-2 portal-text-body font-semibold text-ink-900">
                        <Database className="h-4 w-4 text-ink-400" />
                        {connectionName}
                    </div>
                    <p className="mb-3 truncate font-mono portal-text-caption text-ink-500">{databaseName}</p>
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
                        <Input
                            ref={searchRef}
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            placeholder="Search tables…  ⌘K"
                            className="h-9 pl-8 portal-text-body"
                        />
                    </div>
                </div>
                <ul className="max-h-[28rem] overflow-auto py-1">
                    {visible.length === 0 ? (
                        <li className="px-3 py-6 text-center portal-text-caption text-ink-400">No matching tables</li>
                    ) : visible.map((table) => (
                        <li key={`${table.schema}.${table.name}`}>
                            <button
                                type="button"
                                onClick={() => openTable(table)}
                                className={cn(
                                    'flex w-full items-center gap-2 px-3 py-1.5 text-left portal-text-caption hover:bg-ink-100',
                                    selected?.name === table.name && selected?.schema === table.schema
                                        && 'bg-ink-100 font-semibold',
                                )}
                            >
                                <Table2 className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                                <span className="truncate">{table.name}</span>
                                <span className="ml-auto shrink-0 portal-text-micro text-ink-400">
                                    ~{table.estimated_rows}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            </aside>

            <section className="min-w-0 flex-1 portal-surface">
                <div className="flex items-center justify-between gap-4 border-b border-ink-200 px-4 py-2.5">
                    <div className="flex gap-1">
                        {(['data', 'structure', 'sql'] as Tab[]).map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setTab(t)}
                                className={cn(
                                    'rounded-md px-3 py-1.5 portal-text-body capitalize transition-colors',
                                    tab === t ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100',
                                )}
                            >
                                {t === 'sql' ? 'SQL' : t}
                            </button>
                        ))}
                    </div>
                    <span
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 portal-text-caption font-medium',
                            allowWrites ? 'bg-warning-50 text-warning-700' : 'bg-ink-100 text-ink-600',
                        )}
                        title={allowWrites
                            ? 'This connection permits statements that modify data.'
                            : 'Statements run in a read-only transaction; writes are refused by the database.'}
                    >
                        {allowWrites ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                        {allowWrites ? 'Writes enabled' : 'Read-only'}
                    </span>
                </div>

                <div className="p-4">
                    {tab === 'structure' && selected ? (
                        <div className="portal-stack">
                            <div>
                                <h3 className="mb-2 portal-text-body font-semibold text-ink-900">
                                    {selected.schema}.{selected.name}
                                    <span className="ml-2 font-normal text-ink-400">
                                        {selected.kind} · ~{selected.estimated_rows} rows · {formatBytes(selected.size_bytes)}
                                    </span>
                                </h3>
                                <div className="overflow-x-auto rounded-md border border-ink-200">
                                    <table className="w-full border-collapse text-left portal-text-caption">
                                        <thead className="bg-ink-50">
                                            <tr>
                                                {['Column', 'Type', 'Nullable', 'Default'].map((h) => (
                                                    <th key={h} className="border-b border-ink-200 px-3 py-2 font-semibold text-ink-700">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selected.columns.map((c) => (
                                                <tr key={c.name} className="even:bg-ink-50/60">
                                                    <td className="border-b border-ink-100 px-3 py-1.5 font-mono text-ink-800">
                                                        <span className="inline-flex items-center gap-1.5">
                                                            {c.is_primary_key ? <KeyRound className="h-3 w-3 text-warning-600" /> : null}
                                                            {c.name}
                                                        </span>
                                                    </td>
                                                    <td className="border-b border-ink-100 px-3 py-1.5 font-mono text-ink-600">{c.type}</td>
                                                    <td className="border-b border-ink-100 px-3 py-1.5 text-ink-500">{c.nullable ? 'yes' : 'no'}</td>
                                                    <td className="max-w-xs truncate border-b border-ink-100 px-3 py-1.5 font-mono text-ink-500">{c.default ?? '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {selected.foreign_keys.length > 0 ? (
                                <div>
                                    <h4 className="mb-2 flex items-center gap-1.5 portal-text-body font-semibold text-ink-900">
                                        <Link2 className="h-4 w-4 text-ink-400" />Foreign keys
                                    </h4>
                                    <ul className="space-y-1 font-mono portal-text-caption text-ink-600">
                                        {selected.foreign_keys.map((fk) => <li key={fk.name}>{fk.definition}</li>)}
                                    </ul>
                                </div>
                            ) : null}

                            {selected.indexes.length > 0 ? (
                                <div>
                                    <h4 className="mb-2 portal-text-body font-semibold text-ink-900">Indexes</h4>
                                    <ul className="space-y-1 font-mono portal-text-caption text-ink-600">
                                        {selected.indexes.map((ix) => <li key={ix.name}>{ix.definition}</li>)}
                                    </ul>
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {tab === 'sql' || tab === 'data' ? (
                        <div className="space-y-3">
                            <textarea
                                value={sql}
                                onChange={(e) => setSql(e.target.value)}
                                onKeyDown={(e) => {
                                    // Cmd/Ctrl+Enter runs, the convention in every
                                    // SQL console; plain Enter stays a newline.
                                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                        e.preventDefault();
                                        void execute(sql);
                                    }
                                }}
                                spellCheck={false}
                                rows={tab === 'sql' ? 8 : 3}
                                placeholder="SELECT * FROM …"
                                className="w-full rounded-md border border-ink-200 bg-ink-50/50 p-3 font-mono portal-text-caption text-ink-900 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            />
                            <div className="flex items-center gap-3">
                                <Button
                                    type="button"
                                    onClick={() => void execute(sql)}
                                    disabled={running || !sql.trim()}
                                    className="bg-ink-900 text-white hover:bg-ink-800"
                                >
                                    {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                    {running ? 'Running…' : 'Run'}
                                </Button>
                                <span className="portal-text-caption text-ink-400">⌘↵ to run</span>
                            </div>

                            {error ? (
                                <Notice tone="error">{error}</Notice>
                            ) : null}
                            {result ? <ResultGrid result={result} /> : (
                                <p className="rounded-md border border-dashed border-ink-300 px-3.5 py-6 text-center portal-text-caption text-ink-400">
                                    {selected
                                        ? `Run the statement to read ${selected.schema}.${selected.name}.`
                                        : 'Pick a table, or write a statement.'}
                                </p>
                            )}
                        </div>
                    ) : null}
                </div>
            </section>
        </div>
    );
}
