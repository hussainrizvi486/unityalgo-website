'use client';

import { Notice } from '@/components/ui/notice';
import * as React from 'react';
import {
    AlertTriangle, Database, KeyRound, Link2, Loader2, Lock, Play, Search, Table2, Unlock,
} from 'lucide-react';
import type { DatabaseEngine, DbQueryResult, DbSchema, DbTable } from '@/lib/controller-client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/utils';

type Tab = 'data' | 'structure' | 'sql';

const TABLE_LIST_LIMIT = 400;

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
    return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

const ENGINE_LABEL: Record<DatabaseEngine, string> = { postgres: 'PostgreSQL', mariadb: 'MariaDB' };

function quoteIdent(name: string, engine: DatabaseEngine) {
    if (engine === 'mariadb') return `\`${name.replace(/`/g, '``')}\``;
    return /^[a-z_][a-z0-9_]*$/.test(name) ? name : `"${name.replace(/"/g, '""')}"`;
}

function qualified(table: DbTable, engine: DatabaseEngine) {
    return `${quoteIdent(table.schema, engine)}.${quoteIdent(table.name, engine)}`;
}

function ResultGrid({ result }: { result: DbQueryResult }) {
    if (result.kind === 'status') {
        return (
            <div className="rounded-md border border-border bg-muted px-4 py-3 portal-text-body text-foreground/80">
                {result.affected_rows} row{result.affected_rows === 1 ? '' : 's'} affected
                <span className="ml-2 text-muted-foreground">· {result.duration_ms} ms</span>
            </div>
        );
    }

    if (result.row_count === 0) {
        return (
            <div className="rounded-md border border-border bg-muted px-4 py-3 portal-text-body text-muted-foreground">
                No rows · {result.duration_ms} ms
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center gap-2 pb-2 portal-text-caption text-muted-foreground">
                <span>{result.row_count} row{result.row_count === 1 ? '' : 's'}</span>
                <span>· {result.duration_ms} ms</span>
                {result.truncated ? (
                    <span className="inline-flex items-center gap-1 rounded bg-warning/10 px-1.5 py-0.5 text-warning">
                        <AlertTriangle className="h-3 w-3" />
                        truncated — add a LIMIT to see a specific slice
                    </span>
                ) : null}
            </div>
            {}
            <div className="max-h-104 overflow-auto rounded-md border border-border">
                <table className="w-full border-collapse text-left portal-text-caption">
                    <thead className="sticky top-0 bg-muted">
                        <tr>
                            {result.columns.map((c) => (
                                <th key={c} className="whitespace-nowrap border-b border-border px-3 py-2 font-semibold text-foreground/80">
                                    {c}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="font-mono">
                        {result.rows.map((row, i) => (
                            <tr key={i} className="even:bg-muted/60">
                                {row.map((cell, j) => (
                                    <td key={j} className="max-w-xs truncate border-b border-border/60 px-3 py-1.5 text-foreground">
                                        {cell === null
                                            ? <span className="italic text-muted-foreground">null</span>
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
    engine,
    allowWrites,
    schema,
    runQuery,
}: {
    connectionId: string;
    connectionName: string;
    databaseName: string;
    engine: DatabaseEngine;
    allowWrites: boolean;
    schema: DbSchema | null;
    runQuery: (connectionId: string, sql: string) => Promise<{ result?: DbQueryResult; error?: string }>;
}) {
    const tables = React.useMemo(() => schema?.tables ?? [], [schema]);
    const [selected, setSelected] = React.useState<DbTable | null>(tables[0] ?? null);
    const [tab, setTab] = React.useState<Tab>('data');
    const [filter, setFilter] = React.useState('');
    const [schemaFilter, setSchemaFilter] = React.useState('all');
    const schemas = React.useMemo(() => [...new Set(tables.map((table) => table.schema))].sort(), [tables]);
    const [sql, setSql] = React.useState(
        () => (tables[0] ? `SELECT * FROM ${qualified(tables[0], engine)} LIMIT 100` : ''),
    );
    const [result, setResult] = React.useState<DbQueryResult | null>(null);
    const [error, setError] = React.useState('');
    const [running, setRunning] = React.useState(false);
    const searchRef = React.useRef<HTMLInputElement>(null);

    const visible = React.useMemo(() => {
        const needle = filter.trim().toLowerCase();
        return tables.filter(
            (t) => (schemaFilter === 'all' || t.schema === schemaFilter)
                && (!needle || `${t.schema}.${t.name}`.toLowerCase().includes(needle)),
        );
    }, [tables, filter, schemaFilter]);
    const shown = visible.slice(0, TABLE_LIST_LIMIT);

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

    const openTable = React.useCallback((table: DbTable) => {
        setSelected(table);
        setTab('data');
        setSql(`SELECT * FROM ${qualified(table, engine)} LIMIT 100`);
        setResult(null);
        setError('');
    }, [engine]);

    return (
        <div className="flex min-h-136 gap-gap">
            <aside className="w-72 shrink-0 portal-surface">
                <div className="border-b border-border p-3">
                    <div className="mb-2 flex items-center gap-2 portal-text-body font-semibold text-foreground">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        {connectionName}
                    </div>
                    <p className="mb-3 flex items-center gap-2 truncate font-mono portal-text-caption text-muted-foreground">
                        <span className="rounded bg-secondary px-1.5 py-0.5 font-sans portal-text-micro font-semibold uppercase tracking-caps">{ENGINE_LABEL[engine]}</span>
                        <span className="truncate">{databaseName}</span>
                    </p>
                    {schemas.length > 1 && (
                        <Select value={schemaFilter} onValueChange={setSchemaFilter}>
                            <SelectTrigger className="mb-2 h-9 w-full" aria-label="Database"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All databases ({schemas.length})</SelectItem>
                                {schemas.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )}
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            ref={searchRef}
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            placeholder="Search tables…  ⌘K"
                            className="h-9 pl-8 portal-text-body"
                        />
                    </div>
                </div>
                <ul className="max-h-112 overflow-auto py-1">
                    {visible.length === 0 ? (
                        <li className="px-3 py-6 text-center portal-text-caption text-muted-foreground">No matching tables</li>
                    ) : shown.map((table) => (
                        <li key={`${table.schema}.${table.name}`}>
                            <button
                                type="button"
                                onClick={() => openTable(table)}
                                className={cn(
                                    'flex w-full items-center gap-2 px-3 py-1.5 text-left portal-text-caption hover:bg-secondary',
                                    selected?.name === table.name && selected?.schema === table.schema
                                        && 'bg-secondary font-semibold',
                                )}
                            >
                                <Table2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <span className="truncate">{table.name}</span>
                                {schemaFilter === 'all' && schemas.length > 1 && (
                                    <span className="truncate font-mono portal-text-micro text-muted-foreground">{table.schema}</span>
                                )}
                                <span className="ml-auto shrink-0 portal-text-micro text-muted-foreground">
                                    ~{table.estimated_rows}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
                {visible.length > shown.length && (
                    <p className="border-t border-border px-3 py-2 portal-text-caption text-muted-foreground">
                        Showing {shown.length} of {visible.length} tables. Pick a database or search to narrow it.
                    </p>
                )}
            </aside>

            <section className="min-w-0 flex-1 portal-surface">
                <div className="flex items-center justify-between gap-gap border-b border-border px-4 py-2.5">
                    <div className="flex gap-1">
                        {(['data', 'structure', 'sql'] as Tab[]).map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setTab(t)}
                                className={cn(
                                    'rounded-md px-3 py-1.5 portal-text-body capitalize transition-colors',
                                    tab === t ? 'bg-primary text-primary-foreground' : 'text-foreground/70 hover:bg-secondary',
                                )}
                            >
                                {t === 'sql' ? 'SQL' : t}
                            </button>
                        ))}
                    </div>
                    <span
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 portal-text-caption font-medium',
                            allowWrites ? 'bg-warning/10 text-warning' : 'bg-secondary text-foreground/70',
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
                                <h3 className="mb-2 portal-text-body text-foreground">
                                    {selected.schema}.{selected.name}
                                    <span className="ml-2 font-normal text-muted-foreground">
                                        {selected.kind} · ~{selected.estimated_rows} rows · {formatBytes(selected.size_bytes)}
                                    </span>
                                </h3>
                                <div className="overflow-x-auto rounded-md border border-border">
                                    <table className="w-full border-collapse text-left portal-text-caption">
                                        <thead className="bg-muted">
                                            <tr>
                                                {['Column', 'Type', 'Nullable', 'Default'].map((h) => (
                                                    <th key={h} className="border-b border-border px-3 py-2 font-semibold text-foreground/80">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selected.columns.map((c) => (
                                                <tr key={c.name} className="even:bg-muted/60">
                                                    <td className="border-b border-border/60 px-3 py-1.5 font-mono text-foreground">
                                                        <span className="inline-flex items-center gap-1.5">
                                                            {c.is_primary_key ? <KeyRound className="h-3 w-3 text-warning" /> : null}
                                                            {c.name}
                                                        </span>
                                                    </td>
                                                    <td className="border-b border-border/60 px-3 py-1.5 font-mono text-foreground/70">{c.type}</td>
                                                    <td className="border-b border-border/60 px-3 py-1.5 text-muted-foreground">{c.nullable ? 'yes' : 'no'}</td>
                                                    <td className="max-w-xs truncate border-b border-border/60 px-3 py-1.5 font-mono text-muted-foreground">{c.default ?? '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {selected.foreign_keys.length > 0 ? (
                                <div>
                                    <h4 className="mb-2 flex items-center gap-1.5 portal-text-body text-foreground">
                                        <Link2 className="h-4 w-4 text-muted-foreground" />Foreign keys
                                    </h4>
                                    <ul className="space-y-1 font-mono portal-text-caption text-foreground/70">
                                        {selected.foreign_keys.map((fk) => <li key={fk.name}>{fk.definition}</li>)}
                                    </ul>
                                </div>
                            ) : null}

                            {selected.indexes.length > 0 ? (
                                <div>
                                    <h4 className="mb-2 portal-text-body text-foreground">Indexes</h4>
                                    <ul className="space-y-1 font-mono portal-text-caption text-foreground/70">
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
                                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                        e.preventDefault();
                                        void execute(sql);
                                    }
                                }}
                                spellCheck={false}
                                rows={tab === 'sql' ? 8 : 3}
                                placeholder="SELECT * FROM …"
                                className="w-full rounded-md border border-border bg-muted/50 p-3 font-mono portal-text-caption text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            />
                            <div className="flex items-center gap-3">
                                <Button
                                    type="button"
                                    onClick={() => void execute(sql)}
                                    disabled={running || !sql.trim()}
                                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                                >
                                    {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                    {running ? 'Running…' : 'Run'}
                                </Button>
                                <span className="portal-text-caption text-muted-foreground">⌘↵ to run</span>
                            </div>

                            {error ? (
                                <Notice tone="error">{error}</Notice>
                            ) : null}
                            {result ? <ResultGrid result={result} /> : (
                                <p className="rounded-md border border-dashed border-input px-3.5 py-6 text-center portal-text-caption text-muted-foreground">
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
