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
    /** Most customer sites this server may host; null means no limit. */
    max_sites: number | null;
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
export type DatabaseEngine = 'postgres' | 'mariadb';

export interface ControllerDatabase {
    id: string;
    /** PostgreSQL hosts UnityCommerce tenants; MariaDB hosts Frappe sites. */
    engine: DatabaseEngine;
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
    engine?: DatabaseEngine;
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
    step_name?: string;
    step_index?: number;
    status: string;
    message: string | null;
    error_message?: string | null;
    duration_ms?: number | null;
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

export type SiteAction = 'stop' | 'start' | 'restart' | 'backup' | 'deactivate' | 'reactivate';

/** A site as the admin panel sees it: any customer's, with the account that owns it. */
export interface AdminSite extends CustomerSite {
    owner_account_email: string;
    user_id: string;
}

export interface SiteUsage {
    cpu_percent: number;
    memory_mb: number;
    memory_limit_mb: number;
    storage_mb: number;
}

/** One backup: its database, files and config share a timestamp and are restored together. */
export interface SiteBackupSet {
    stamp: string;
    kind: 'manual' | 'scheduled' | 'safety';
    size_bytes: number;
    /** Unix seconds. */
    created_at: number;
    files: { name: string; type: 'database' | 'files' | 'private-files' | 'config' | 'other'; size_bytes: number }[];
}

export interface SiteDomain {
    id: string;
    domain: string;
    status: 'pending' | 'active';
    error: string | null;
    tls_status: 'pending' | 'active' | null;
    verified_at: string | null;
}

export interface SiteDomains {
    results: SiteDomain[];
    /** The site's own address, the CNAME target. */
    target: string;
    /** The proxy's address, for an A record. */
    proxy_ips: string[];
    limit: number;
}

/** One site with everything an operator needs to diagnose it. */
export interface AdminSiteDetail {
    site: AdminSite;
    server: { id: string; name: string; ip_address: string; port: number; memory_mb: number; cpu_cores: number | null; status: string | null };
    database: { name: string; host: string; engine: string } | null;
    domains: SiteDomain[];
    backups: { stamp: string; kind: string; created_at: string }[];
    operations: { id: string; kind: string; label: string; status: string; started_at: string | null; duration_ms: number | null; error: string | null }[];
}

export interface SiteBackups {
    results: SiteBackupSet[];
    available: boolean;
    schedule: 'off' | 'daily' | 'weekly';
    retention: number;
    last_at: string | null;
}

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
    plan_id: string | null;
    plan_name: string | null;
    owner_email: string | null;
    /** Registered MariaDB server holding the database; null = the site's own container. */
    db_server: string | null;
    /** Background work on a running site, e.g. 'backup'. */
    activity: string | null;
    /** 1 for the first provisioning attempt; each retry adds one. */
    attempt: number;
    /** What the site's plan grants. */
    resources: { vcpu: number; ram_mb: number; storage_gb: number; users: number | null };
    /** The latest seat and storage audit against that plan. */
    limits: { state: 'ok' | 'users' | 'storage' | 'both' | null; user_count: number | null; storage_used_mb: number | null; audited_at: string | null };
    backup: { schedule: 'off' | 'daily' | 'weekly'; retention: number; last_at: string | null };
    error: string | null;
    steps: { key: string; label: string; state: 'done' | 'active' | 'pending' | 'failed' }[];
    created_at: string;
    updated_at: string;
}

// ---- App Store: GitHub apps and rollouts ----
export type Compatibility = 'compatible' | 'incompatible' | 'unknown';
export interface AppInspection {
    repo_url: string;
    owner: string;
    repo: string;
    app_name: string;
    title: string;
    description: string;
    publisher: string;
    stars: number;
    license: string | null;
    default_branch: string;
    branches: string[];
    branch: string;
    commit: { sha: string; message: string; date: string | null; author: string | null };
    version: string | null;
    frappe_range: string | null;
    compatibility: { status: Compatibility; reason: string };
    target_majors: number[];
    html_url: string;
    private: boolean;
}
export interface GithubAccount {
    connected: boolean;
    source: 'account' | 'environment' | null;
    /** Set when GitHub no longer accepts the saved token. */
    problem: string | null;
    login?: string;
    name?: string | null;
    avatar_url?: string | null;
    html_url?: string | null;
    scopes?: string | null;
    connected_by?: string | null;
    connected_at?: string | null;
    rate_limit?: string | null;
    rate_remaining?: string | null;
}
export interface GithubRepository {
    full_name: string;
    private: boolean;
    description: string;
    default_branch: string | null;
    html_url: string | null;
    pushed_at: string | null;
}
export interface AppInstallation {
    id: string;
    slug: string;
    name: string;
    domain: string;
    status: string;
    owner_email: string | null;
    plan_name: string | null;
    server_name: string | null;
    image: string;
    installed: {
        version: string | null;
        commit: string | null;
        branch: string | null;
        scanned_at: string | null;
        up_to_date?: boolean | null;
        commits_behind?: number | null;
    } | null;
    eligible: boolean;
    reason: string | null;
}
export type RolloutStatus = 'running' | 'completed' | 'partial' | 'failed';
export type RolloutSiteStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';
export interface AppRolloutSite {
    id: string;
    site_id: string;
    site_slug: string;
    status: RolloutSiteStatus;
    step: string | null;
    progress: number;
    from_version: string | null;
    from_commit: string | null;
    to_version: string | null;
    to_commit: string | null;
    backup_stamp: string | null;
    rolled_back: boolean;
    error: string | null;
    log?: string | null;
    operation_id: string | null;
    started_at: string | null;
    finished_at: string | null;
}
export interface AppRollout {
    id: string;
    app_name: string;
    repo_url: string;
    branch: string;
    target_commit: string;
    target_version: string | null;
    action: 'install' | 'update';
    status: RolloutStatus;
    note: string | null;
    created_by: string | null;
    created_at: string;
    finished_at: string | null;
    site_count: number;
    counts: Record<RolloutSiteStatus, number>;
    sites?: AppRolloutSite[];
}
export interface RolloutRequest {
    app_name: string;
    repo_url: string;
    branch: string;
    action: 'install' | 'update';
    site_ids?: string[];
    all_sites?: boolean;
    commit?: string;
    note?: string;
    allow_unverified?: boolean;
    created_by?: string;
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
        action: (id: string, userId: string, action: SiteAction) =>
            request<{ queued: boolean }>(
                `/api/v1/sites/${encodeURIComponent(id)}/actions/${action}`,
                { method: 'POST', body: { user_id: userId }, timeoutMs: 20_000 },
            ),
        changePlan: (id: string, userId: string, plan: Record<string, unknown>) =>
            request<{ queued: boolean }>(
                `/api/v1/sites/${encodeURIComponent(id)}/change-plan`,
                { method: 'POST', body: { user_id: userId, ...plan }, timeoutMs: 20_000 },
            ),
        resetPassword: (id: string, userId: string, newPassword: string) =>
            request<{ ok: boolean }>(
                `/api/v1/sites/${encodeURIComponent(id)}/reset-password`,
                { method: 'POST', body: { user_id: userId, new_password: newPassword }, timeoutMs: 150_000 },
            ),
        remove: (id: string, userId: string, confirm: string) =>
            request<{ queued: boolean }>(
                `/api/v1/sites/${encodeURIComponent(id)}/delete`,
                { method: 'POST', body: { user_id: userId, confirm }, timeoutMs: 20_000 },
            ),
        adminList: () =>
            request<{ results: AdminSite[] }>('/api/v1/sites/admin', { timeoutMs: 20_000 }),
        adminGet: (id: string) =>
            request<AdminSiteDetail>(`/api/v1/sites/admin/${encodeURIComponent(id)}`, { timeoutMs: 20_000 }),
        adminAction: (id: string, action: SiteAction) =>
            request<{ queued: boolean }>(
                `/api/v1/sites/admin/${encodeURIComponent(id)}/actions/${action}`,
                { method: 'POST', body: {}, timeoutMs: 20_000 },
            ),
        adminUsage: (id: string) =>
            request<SiteUsage>(`/api/v1/sites/admin/${encodeURIComponent(id)}/usage`, { timeoutMs: 90_000 }),
        adminQueue: () =>
            request<{ workers: number; waiting: number | null; sites_waiting: number }>(
                '/api/v1/sites/admin/queue',
                { timeoutMs: 10_000 },
            ),
        adminForceDelete: (id: string) =>
            request<{ queued: boolean }>(
                `/api/v1/sites/admin/${encodeURIComponent(id)}/force-delete`,
                { method: 'POST', timeoutMs: 20_000 },
            ),
        usage: (id: string, userId: string) =>
            request<SiteUsage>(
                `/api/v1/sites/${encodeURIComponent(id)}/usage?user_id=${encodeURIComponent(userId)}`,
                { timeoutMs: 90_000 },
            ),
        backups: (id: string, userId: string) =>
            request<SiteBackups>(
                `/api/v1/sites/${encodeURIComponent(id)}/backups?user_id=${encodeURIComponent(userId)}`,
                { timeoutMs: 90_000 },
            ),
        domains: (id: string, userId: string) =>
            request<SiteDomains>(
                `/api/v1/sites/${encodeURIComponent(id)}/domains?user_id=${encodeURIComponent(userId)}`,
                { timeoutMs: 30_000 },
            ),
        addDomain: (id: string, userId: string, domain: string) =>
            request<SiteDomain>(
                `/api/v1/sites/${encodeURIComponent(id)}/domains`,
                { method: 'POST', body: { user_id: userId, domain }, timeoutMs: 20_000 },
            ),
        verifyDomain: (id: string, userId: string, domainId: string) =>
            request<SiteDomain>(
                `/api/v1/sites/${encodeURIComponent(id)}/domains/${encodeURIComponent(domainId)}/verify`,
                { method: 'POST', body: { user_id: userId }, timeoutMs: 60_000 },
            ),
        removeDomain: (id: string, userId: string, domainId: string) =>
            request<void>(
                `/api/v1/sites/${encodeURIComponent(id)}/domains/${encodeURIComponent(domainId)}?user_id=${encodeURIComponent(userId)}`,
                { method: 'DELETE', timeoutMs: 60_000 },
            ),
        backupSettings: (id: string, userId: string, schedule: string, retention: number) =>
            request<{ schedule: string; retention: number }>(
                `/api/v1/sites/${encodeURIComponent(id)}/backup-settings`,
                { method: 'POST', body: { user_id: userId, schedule, retention }, timeoutMs: 20_000 },
            ),
        restore: (id: string, userId: string, stamp: string, confirm: string) =>
            request<{ queued: boolean }>(
                `/api/v1/sites/${encodeURIComponent(id)}/restore`,
                { method: 'POST', body: { user_id: userId, stamp, confirm }, timeoutMs: 20_000 },
            ),
        /** The raw response, so a large backup streams to the browser instead of being buffered. */
        backupFile: (id: string, userId: string, name: string) =>
            fetch(
                `${BASE_URL}/api/v1/sites/${encodeURIComponent(id)}/backups/${encodeURIComponent(name)}?user_id=${encodeURIComponent(userId)}`,
                { headers: { 'X-Controller-Key': apiKey() }, cache: 'no-store' },
            ),
        checkSlug: (slug: string) =>
            request<{ slug: string; available: boolean; reason: string | null }>(
                `/api/v1/sites/check-slug?slug=${encodeURIComponent(slug)}`,
                { timeoutMs: 10_000 },
            ),
        capabilities: () =>
            request<{ apps: string[]; configured: boolean; domain_suffix: string; accepting: boolean }>(
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

    apps: {
        inspect: (repoUrl: string, branch?: string) =>
            request<AppInspection>('/api/v1/apps/inspect', {
                method: 'POST',
                body: { repo_url: repoUrl, branch },
                timeoutMs: 45_000,
            }),
        installations: (appName: string, repoUrl?: string | null, branch?: string | null) =>
            request<{ app_name: string; results: AppInstallation[] }>('/api/v1/apps/installations', {
                method: 'POST',
                body: { app_name: appName, repo_url: repoUrl ?? undefined, branch: branch ?? undefined },
                timeoutMs: 60_000,
            }),
        summary: () =>
            request<{ results: Record<string, { sites: number; commits: Record<string, number> }> }>('/api/v1/apps/summary', {
                timeoutMs: 20_000,
            }),
        scan: () => request<{ queued: boolean }>('/api/v1/apps/scan', { method: 'POST', body: {}, timeoutMs: 20_000 }),
        rollouts: (appName?: string) =>
            request<{ results: AppRollout[] }>(
                `/api/v1/apps/rollouts${toQuery({ app_name: appName })}`,
                { timeoutMs: 20_000 },
            ),
        rollout: (id: string) =>
            request<AppRollout>(`/api/v1/apps/rollouts/${encodeURIComponent(id)}`, { timeoutMs: 20_000 }),
        startRollout: (body: RolloutRequest) =>
            request<AppRollout>('/api/v1/apps/rollouts', { method: 'POST', body, timeoutMs: 60_000 }),
        retryRollout: (id: string) =>
            request<{ queued: number }>(`/api/v1/apps/rollouts/${encodeURIComponent(id)}/retry`, {
                method: 'POST',
                body: {},
                timeoutMs: 20_000,
            }),
    },

    github: {
        account: () => request<GithubAccount>('/api/v1/github/account', { timeoutMs: 25_000 }),
        connect: (token: string, connectedBy: string) =>
            request<GithubAccount>('/api/v1/github/account', { method: 'PUT', body: { token, connected_by: connectedBy }, timeoutMs: 30_000 }),
        disconnect: () => request<void>('/api/v1/github/account', { method: 'DELETE', timeoutMs: 20_000 }),
        repositories: () =>
            request<{ results: GithubRepository[]; connected: boolean }>('/api/v1/github/repositories', { timeoutMs: 30_000 }),
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
