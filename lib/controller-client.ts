import 'server-only';

/**
 * Typed client for the controller API (the Python/Flask service in
 * controller/).
 *
 * Server-only by construction. The `server-only` import above makes the build
 * fail if a Client Component ever imports this, because every call carries
 * CONTROLLER_INTERNAL_API_KEY — the single shared secret protecting endpoints
 * that can SSH into production nodes. It must never reach a browser.
 *
 * Callers are Server Components and Server Actions under app/admin, which run
 * only after proxy.ts has verified an admin session.
 */

const BASE_URL = process.env.CONTROLLER_API_URL ?? 'http://127.0.0.1:8000';

export class ControllerError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
        this.name = 'ControllerError';
    }
}

function apiKey() {
    const key = process.env.CONTROLLER_INTERNAL_API_KEY;
    if (!key) {
        throw new ControllerError(
            'CONTROLLER_INTERNAL_API_KEY is not set — the admin panel cannot reach the controller API.',
            500,
        );
    }
    return key;
}

interface RequestOptions {
    timeoutMs?: number;
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: unknown;
    /** Seconds to cache a GET for. Omit to always hit the API. */
    revalidate?: number;
}

async function request<T>(
    path: string,
    options: RequestOptions = {},
): Promise<T> {
    const { method = 'GET', body, revalidate } = options;

    let response: Response;
    try {
        response = await fetch(`${BASE_URL}${path}`, {
            method,
            signal: options.timeoutMs
                ? AbortSignal.timeout(options.timeoutMs)
                : undefined,
            headers: {
                'X-Controller-Key': apiKey(),
                ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
            // Infrastructure state changes outside this app (a health sweep,
            // a Celery task completing), so caching is opt-in per call.
            cache: revalidate === undefined ? 'no-store' : undefined,
            next: revalidate === undefined ? undefined : { revalidate },
        });
    } catch {
        // A refused connection here means the Python service is down, which
        // is worth saying plainly rather than surfacing "fetch failed".
        throw new ControllerError(
            `Controller API is unreachable at ${BASE_URL}. Is it running? (cd controller && python main.py serve)`,
            503,
        );
    }

    if (response.status === 204) return undefined as T;

    const text = await response.text();
    const payload = text ? safeJson(text) : null;

    if (!response.ok) {
        const message =
            (payload && typeof payload === 'object' && 'error' in payload
                ? String((payload as { error: unknown }).error)
                : null) ?? `Controller API returned ${response.status}`;
        throw new ControllerError(message, response.status);
    }

    return payload as T;
}

function safeJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------- types

export type ServerRole = 'worker' | 'proxy';

export interface ControllerServer {
    frappe_enabled: boolean;
    id: string;
    name: string;
    ip_address: string;
    private_ip: string | null;
    role: ServerRole;
    ssh_port: number;
    ssh_user: string;
    ssh_auth_method: string | null;
    max_memory_mb: number;
    used_memory_mb: number;
    max_containers: number;
    active_containers: number;
    is_active: boolean;
    cpu_cores: number | null;
    disk_total_gb: number | null;
    disk_used_gb: number | null;
    os_name: string | null;
    kernel_version: string | null;
    architecture: string | null;
    docker_version: string | null;
    last_checked_at: string | null;
    last_check_status: string | null;
    created_at: string;
}

export type TenantStatus = 'pending' | 'active' | 'paused' | 'terminated';

/** The platform account a tenant belongs to, resolved via its subscription. */
export interface ControllerTenantCustomer {
    id: string;
    name: string;
    email: string;
    company: string | null;
}

/** The subscription funding a tenant, with the plan it is on. */
export interface ControllerTenantSubscription {
    id: string;
    status: string;
    store_name: string | null;
    plan: {
        id: string;
        name: string;
        slug: string;
        price_amount: number | null;
        price_unit: string;
    } | null;
}

export interface ControllerTenant {
    id: string;
    tenant_slug: string;
    customer_email: string;
    user_id: string | null;
    subscription_id: string | null;
    /** Cache of the linked plan's slug; authoritative name is in `subscription.plan`. */
    plan_tier: string;
    /** Null for a tenant created with only an email, before accounts existed. */
    customer: ControllerTenantCustomer | null;
    subscription: ControllerTenantSubscription | null;
    status: TenantStatus;
    assigned_subdomain: string | null;
    custom_domain: string | null;
    memory_limit_mb: number;
    cpu_limit_cores: string | number;
    node_id: string | null;
    database_connection_id: string | null;
    /** Null means the legacy default cluster. */
    database_cluster: string | null;
    created_at: string;
    updated_at: string;
}

export type ClusterRole = 'cluster' | 'external';

export interface ControllerDatabase {
    id: string;
    name: string;
    host: string;
    port: number;
    database_name: string;
    username: string;
    has_password: boolean;
    sslmode: string;
    role: ClusterRole;
    /** Address a tenant container uses; falls back to `host` when unset. */
    host_from_worker: string | null;
    is_default: boolean;
    /** Whether the query console may run statements that modify data. */
    allow_writes: boolean;
    notes: string | null;
    last_tested_at: string | null;
    last_test_status: string | null;
    last_test_message: string | null;
    created_at: string;
}

/** One column, as reported by the schema browser. */
export interface DbColumn {
    name: string;
    position: number;
    type: string;
    nullable: boolean;
    default: string | null;
    is_primary_key: boolean;
}

export interface DbTable {
    schema: string;
    name: string;
    kind: 'table' | 'view' | 'materialized view';
    /** Planner estimate, not a COUNT(*) — exact counts would read every table. */
    estimated_rows: number;
    size_bytes: number;
    columns: DbColumn[];
    indexes: { name: string; definition: string }[];
    foreign_keys: { name: string; definition: string }[];
}

export interface DbSchema {
    database: string;
    tables: DbTable[];
}

/**
 * A statement's result. `rows` for anything that produced a result set,
 * `status` for INSERT/UPDATE/DELETE/DDL, mirroring what the cursor reported.
 */
export type DbQueryResult =
    | {
          kind: 'rows';
          columns: string[];
          rows: (string | number | boolean | null)[][];
          row_count: number;
          truncated: boolean;
          duration_ms: number;
      }
    | { kind: 'status'; affected_rows: number; duration_ms: number };

export interface ControllerDbMigration {
    id: string;
    tenant_id: string;
    from_connection_id: string | null;
    /** Null means the legacy default cluster, which has no registered row. */
    from_cluster: string | null;
    to_connection_id: string;
    to_cluster: string | null;
    status: string;
    size_bytes: number | null;
    error_message: string | null;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
}

export interface ControllerDomain {
    id: string;
    tenant_id: string;
    deployment_id: string | null;
    domain: string;
    domain_type: 'platform' | 'custom';
    status: 'pending' | 'active' | 'disabled';
    ssl_status: string;
    verified_at: string | null;
}

/**
 * One end-to-end process recorded by the controller.
 *
 * Field names mirror OperationSerializer in controller/app/serializers.py
 * exactly — an earlier version of this interface guessed at `name`, `message`
 * and `finished_at`, none of which the API sends, so the operations list
 * rendered blank titles.
 */
export interface ControllerOperation {
    id: string;
    kind: string;
    /** Human-readable summary, e.g. "Tenant creation: north-and-co". */
    label: string;
    category: string;
    status: string;
    step_count: number | null;
    duration_ms: number | null;
    error_message: string | null;
    actor: string | null;
    tenant_id: string | null;
    tenant_slug: string | null;
    server_id: string | null;
    server_name: string | null;
    customer_id: string | null;
    customer_name: string | null;
    started_at: string | null;
    completed_at: string | null;
}

export interface ControllerActivityLog {
    id: string;
    operation_id: string | null;
    category: string;
    action: string;
    status: string;
    message: string | null;
    actor: string | null;
    tenant_slug: string | null;
    server_name: string | null;
    details: Record<string, unknown> | null;
    created_at: string;
}

/** The API paginates list endpoints under a `results` key. */
interface Paginated<T> {
    results: T[];
    count?: number;
    page?: number;
    page_size?: number;
}

/** Long-running actions return an operation id to poll instead of blocking. */
export interface AsyncAccepted {
    operation_id?: string;
    detail?: string;
}

// ------------------------------------------------------------- endpoints

export interface CustomerSite {
    id: string;
    name: string;
    slug: string;
    domain: string;
    server_id: string;
    server_name: string;
    status: string;
    progress: number;
    message: string;
    apps: string[];
    created_at: string;
    updated_at: string;
}

export const controller = {
    sites: {
        list: (userId: string) =>
            request<{ results: CustomerSite[] }>(
                `/api/v1/sites?user_id=${encodeURIComponent(userId)}`,
                { timeoutMs: 20_000 },
            ),
        get: (id: string, userId: string) =>
            request<CustomerSite>(
                `/api/v1/sites/${encodeURIComponent(id)}?user_id=${encodeURIComponent(userId)}`,
                { timeoutMs: 20_000 },
            ),
        create: (body: Record<string, unknown>) =>
            request<CustomerSite>('/api/v1/sites', {
                method: 'POST',
                body,
                timeoutMs: 20_000,
            }),
        retry: (id: string, userId: string) =>
            request<{ queued: boolean }>(
                `/api/v1/sites/${encodeURIComponent(id)}/retry`,
                {
                    method: 'POST',
                    body: { user_id: userId },
                    timeoutMs: 20_000,
                },
            ),
        capabilities: () =>
            request<{ apps: string[]; configured: boolean }>(
                '/api/v1/sites/capabilities',
                { timeoutMs: 20_000 },
            ),
    },
    servers: {
        list: () => request<Paginated<ControllerServer>>('/api/v1/servers'),
        get: (id: string) => request<ControllerServer>(`/api/v1/servers/${id}`),
        create: (body: Record<string, unknown>) =>
            request<ControllerServer>('/api/v1/servers', {
                method: 'POST',
                body,
            }),
        update: (id: string, body: Record<string, unknown>) =>
            request<ControllerServer>(`/api/v1/servers/${id}`, {
                method: 'PATCH',
                body,
            }),
        remove: (id: string) =>
            request<void>(`/api/v1/servers/${id}`, { method: 'DELETE' }),

        /** SSH reachability probe. */
        check: (id: string) =>
            request<unknown>(`/api/v1/servers/${id}/check`, { method: 'POST' }),
        /** Probe + persist hardware/OS/Docker specs. */
        connect: (id: string) =>
            request<ControllerServer>(`/api/v1/servers/${id}/connect`, {
                method: 'POST',
            }),
        /** Install Docker Engine from scratch. */
        bootstrap: (id: string) =>
            request<AsyncAccepted>(`/api/v1/servers/${id}/bootstrap`, {
                method: 'POST',
            }),
        /** Proxy-role nodes only: run the Caddy edge container. */
        bootstrapCaddy: (id: string) =>
            request<AsyncAccepted>(`/api/v1/servers/${id}/bootstrap-caddy`, {
                method: 'POST',
            }),
        /** Worker-role nodes only: restrict the tenant port range to the proxy. */
        lockdown: (id: string) =>
            request<AsyncAccepted>(`/api/v1/servers/${id}/lockdown`, {
                method: 'POST',
            }),
        containers: (id: string) =>
            request<unknown>(`/api/v1/servers/${id}/containers`),
    },

    tenants: {
        list: (filters?: {
            user_id?: string;
            subscription_id?: string;
            status?: string;
        }) => {
            const query = new URLSearchParams(
                Object.entries(filters ?? {}).filter(([, v]) => v) as [
                    string,
                    string,
                ][],
            ).toString();
            return request<Paginated<ControllerTenant>>(
                `/api/v1/tenants${query ? `?${query}` : ''}`,
            );
        },
        get: (id: string) => request<ControllerTenant>(`/api/v1/tenants/${id}`),
        create: (body: Record<string, unknown>) =>
            request<ControllerTenant>('/api/v1/tenants', {
                method: 'POST',
                body,
            }),
        update: (id: string, body: Record<string, unknown>) =>
            request<ControllerTenant>(`/api/v1/tenants/${id}`, {
                method: 'PATCH',
                body,
            }),
        remove: (id: string) =>
            request<void>(`/api/v1/tenants/${id}`, { method: 'DELETE' }),

        provision: (id: string) =>
            request<AsyncAccepted>(`/api/v1/tenants/${id}/provision`, {
                method: 'POST',
            }),
        redeploy: (id: string) =>
            request<AsyncAccepted>(`/api/v1/tenants/${id}/redeploy`, {
                method: 'POST',
            }),
        stop: (id: string) =>
            request<AsyncAccepted>(`/api/v1/tenants/${id}/stop`, {
                method: 'POST',
            }),
        start: (id: string) =>
            request<AsyncAccepted>(`/api/v1/tenants/${id}/start`, {
                method: 'POST',
            }),
        resize: (id: string, body: Record<string, unknown>) =>
            request<AsyncAccepted>(`/api/v1/tenants/${id}/resize`, {
                method: 'POST',
                body,
            }),
        migrate: (id: string, body: Record<string, unknown>) =>
            request<AsyncAccepted>(`/api/v1/tenants/${id}/migrate`, {
                method: 'POST',
                body,
            }),
        runDbMigrations: (id: string) =>
            request<AsyncAccepted>(`/api/v1/tenants/${id}/db-migrate`, {
                method: 'POST',
            }),

        backups: (id: string) =>
            request<Paginated<Record<string, unknown>>>(
                `/api/v1/tenants/${id}/backups`,
            ),
        createBackup: (id: string) =>
            request<AsyncAccepted>(`/api/v1/tenants/${id}/backups`, {
                method: 'POST',
            }),
        restoreBackup: (id: string, backupId: string) =>
            request<AsyncAccepted>(
                `/api/v1/tenants/${id}/backups/${backupId}/restore`,
                { method: 'POST' },
            ),

        /** Moves the tenant's data to another cluster (dump + restore). */
        migrateDatabase: (id: string, body: Record<string, unknown>) =>
            request<AsyncAccepted>(`/api/v1/tenants/${id}/migrate-database`, {
                method: 'POST',
                body,
            }),
        dbMigrations: (id: string) =>
            request<Paginated<ControllerDbMigration>>(
                `/api/v1/tenants/${id}/db-migrations`,
            ),

        domains: (id: string) =>
            request<Paginated<ControllerDomain>>(
                `/api/v1/tenants/${id}/domains`,
            ),
        addDomain: (id: string, body: Record<string, unknown>) =>
            request<ControllerDomain>(`/api/v1/tenants/${id}/domains`, {
                method: 'POST',
                body,
            }),

        containerLogs: (id: string) =>
            request<unknown>(`/api/v1/tenants/${id}/container-logs`),
    },

    databases: {
        list: () =>
            request<Paginated<ControllerDatabase>>(
                '/api/v1/database-connections',
            ),
        get: (id: string) =>
            request<ControllerDatabase>(`/api/v1/database-connections/${id}`),
        create: (body: Record<string, unknown>) =>
            request<ControllerDatabase>('/api/v1/database-connections', {
                method: 'POST',
                body,
            }),
        update: (id: string, body: Record<string, unknown>) =>
            request<ControllerDatabase>(`/api/v1/database-connections/${id}`, {
                method: 'PATCH',
                body,
            }),
        remove: (id: string) =>
            request<void>(`/api/v1/database-connections/${id}`, {
                method: 'DELETE',
            }),
        /** Opens a real connection and reports the server version. */
        test: (id: string) =>
            request<{ status: string; version?: string; message?: string }>(
                `/api/v1/database-connections/${id}/test`,
                { method: 'POST' },
            ),
        /** Tables, columns, keys and indexes. Always read-only server-side. */
        schema: (id: string) =>
            request<DbSchema>(`/api/v1/database-connections/${id}/schema`),
        /**
         * Runs one statement. Whether writes are permitted is the connection's
         * `allow_writes` setting, enforced by the controller in a Postgres
         * READ ONLY transaction — not by anything sent from here.
         */
        query: (id: string, sql: string) =>
            request<DbQueryResult>(`/api/v1/database-connections/${id}/query`, {
                method: 'POST',
                body: { sql },
            }),
    },

    domains: {
        activate: (id: string) =>
            request<ControllerDomain>(`/api/v1/domains/${id}/activate`, {
                method: 'POST',
            }),
        verify: (id: string) =>
            request<ControllerDomain>(`/api/v1/domains/${id}/verify`, {
                method: 'POST',
            }),
        disable: (id: string) =>
            request<ControllerDomain>(`/api/v1/domains/${id}/disable`, {
                method: 'POST',
            }),
        remove: (id: string) =>
            request<void>(`/api/v1/domains/${id}`, { method: 'DELETE' }),
    },

    logs: {
        list: (params?: Record<string, string | undefined>) =>
            request<Paginated<ControllerActivityLog>>(
                `/api/v1/logs${toQuery(params)}`,
            ),
        operations: (params?: Record<string, string | undefined>) =>
            request<Paginated<ControllerOperation>>(
                `/api/v1/logs/operations${toQuery(params)}`,
            ),
        operation: (id: string) =>
            request<{
                operation: ControllerOperation;
                steps: ControllerActivityLog[];
            }>(`/api/v1/logs/operations/${id}`),
    },

    dashboard: {
        summary: () =>
            request<Record<string, unknown>>('/api/v1/dashboard/summary'),
    },

    proxy: {
        info: () => request<Record<string, unknown>>('/api/v1/proxy/info'),
        sync: () =>
            request<AsyncAccepted>('/api/v1/proxy/sync', { method: 'POST' }),
        verify: () => request<Record<string, unknown>>('/api/v1/proxy/verify'),
    },
};

function toQuery(params?: Record<string, string | undefined>) {
    if (!params) return '';
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value) search.set(key, value);
    }
    const query = search.toString();
    return query ? `?${query}` : '';
}
