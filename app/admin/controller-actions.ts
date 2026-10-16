'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { SignJWT } from 'jose';
import { controller, ControllerError, type DbQueryResult } from '@/lib/controller-client';
import { requireAdmin } from '@/lib/admin-session';

/**
 * Server Actions for the controller (infrastructure) admin pages.
 *
 * Kept separate from app/admin/actions.ts because this is a large, distinct
 * surface that talks to a different backend. Every action re-checks the
 * admin session server-side rather than trusting proxy.ts alone: the
 * middleware only verifies the JWT signature, not the ADMIN role.
 */

export interface ControllerFormState {
    error?: string;
    success?: string;
}

/** Runs an action and turns a ControllerError into a form-level message. */
async function guarded<T>(fn: () => Promise<T>): Promise<ControllerFormState> {
    try {
        await fn();
        return {};
    } catch (error) {
        if (error instanceof ControllerError) return { error: error.message };
        throw error;
    }
}

function refreshServers(id?: string) {
    revalidatePath('/admin/servers');
    if (id) revalidatePath(`/admin/servers/${id}`);
    revalidatePath('/admin/logs');
}

function refreshTenants(id?: string) {
    revalidatePath('/admin/tenants');
    if (id) revalidatePath(`/admin/tenants/${id}`);
    revalidatePath('/admin/logs');
}

// ------------------------------------------------------------------ servers

export async function createServerAction(
    _prev: ControllerFormState | undefined,
    formData: FormData,
): Promise<ControllerFormState> {
    await requireAdmin();

    const name = String(formData.get('name') ?? '').trim();
    const ipAddress = String(formData.get('ip_address') ?? '').trim();
    if (!name || !ipAddress) return { error: 'Name and IP address are required.' };

    const sshPassword = String(formData.get('ssh_password') ?? '');
    const body: Record<string, unknown> = {
        name,
        frappe_enabled: formData.get('frappe_enabled') === 'on',
        ip_address: ipAddress,
        private_ip: String(formData.get('private_ip') ?? '').trim() || null,
        role: String(formData.get('role') ?? 'worker'),
        ssh_port: Number(formData.get('ssh_port') ?? 22),
        ssh_user: String(formData.get('ssh_user') ?? '').trim() || undefined,
        max_memory_mb: Number(formData.get('max_memory_mb') ?? 0) || undefined,
        max_containers: Number(formData.get('max_containers') ?? 0) || undefined,
        // Blank means no limit; 0 is a real limit (take no new sites), so it must not be dropped like the others.
        ...(String(formData.get('max_sites') ?? '').trim() !== '' ? { max_sites: Number(formData.get('max_sites')) } : {}),
    };
    // Only send credentials that were actually filled in, so the controller
    // falls back to its configured defaults rather than storing empty strings.
    if (sshPassword) body.ssh_password = sshPassword;

    const result = await guarded(() => controller.servers.create(body));
    if (result.error) return result;

    refreshServers();
    redirect('/admin/servers');
}

export async function updateServerAction(
    id: string,
    _prev: ControllerFormState | undefined,
    formData: FormData,
): Promise<ControllerFormState> {
    await requireAdmin();

    const body: Record<string, unknown> = {
        name: String(formData.get('name') ?? '').trim(),
        ip_address: String(formData.get('ip_address') ?? '').trim(),
        private_ip: String(formData.get('private_ip') ?? '').trim() || null,
        role: String(formData.get('role') ?? 'worker'),
        ssh_port: Number(formData.get('ssh_port') ?? 22),
        max_memory_mb: Number(formData.get('max_memory_mb') ?? 0) || undefined,
        max_containers: Number(formData.get('max_containers') ?? 0) || undefined,
        // On an edit, blank clears the limit (null), while 0 stays a limit of zero.
        max_sites: String(formData.get('max_sites') ?? '').trim() === '' ? null : Number(formData.get('max_sites')),
        is_active: formData.get('is_active') === 'on',
        frappe_enabled: formData.get('frappe_enabled') === 'on',
    };
    const sshPassword = String(formData.get('ssh_password') ?? '');
    if (sshPassword) body.ssh_password = sshPassword;

    const result = await guarded(() => controller.servers.update(id, body));
    if (result.error) return result;

    refreshServers(id);
    redirect(`/admin/servers/${id}`);
}

export async function deleteServerAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    try {
        await controller.servers.remove(id);
    } catch (error) {
        if (error instanceof ControllerError) {
            redirect(`/admin/servers?error=${encodeURIComponent(error.message)}`);
        }
        throw error;
    }
    refreshServers();
    redirect('/admin/servers');
}

/**
 * One entry point for every per-server maintenance action, so the UI can send
 * `{ id, action }` from a plain form rather than needing a distinct action
 * export (and a distinct form component) for each of five buttons.
 */
export async function serverMaintenanceAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    const action = String(formData.get('action') ?? '');
    if (!id) return;

    const operations: Record<string, () => Promise<unknown>> = {
        check: () => controller.servers.check(id),
        connect: () => controller.servers.connect(id),
        bootstrap: () => controller.servers.bootstrap(id),
        'bootstrap-caddy': () => controller.servers.bootstrapCaddy(id),
        lockdown: () => controller.servers.lockdown(id),
    };

    const run = operations[action];
    if (!run) return;

    try {
        await run();
    } catch (error) {
        if (error instanceof ControllerError) {
            redirect(`/admin/servers/${id}?error=${encodeURIComponent(error.message)}`);
        }
        throw error;
    }

    refreshServers(id);
    redirect(`/admin/servers/${id}?done=${encodeURIComponent(action)}`);
}

// ------------------------------------------------------------------ tenants

export async function createTenantAction(
    _prev: ControllerFormState | undefined,
    formData: FormData,
): Promise<ControllerFormState> {
    await requireAdmin();

    const slug = String(formData.get('tenant_slug') ?? '').trim();
    if (!slug) return { error: 'Tenant slug is required.' };

    const body: Record<string, unknown> = {
        tenant_slug: slug,
        memory_limit_mb: Number(formData.get('memory_limit_mb') ?? 0) || undefined,
        cpu_limit_cores: String(formData.get('cpu_limit_cores') ?? '').trim() || undefined,
    };

    // A subscription carries the customer and the plan with it, so those
    // fields are only sent for a store being created without one.
    const subscriptionId = String(formData.get('subscription_id') ?? '').trim();
    if (subscriptionId && subscriptionId !== 'none') {
        body.subscription_id = subscriptionId;
    } else {
        const email = String(formData.get('customer_email') ?? '').trim();
        if (!email) return { error: 'Pick a subscription, or enter a customer email.' };
        body.customer_email = email;
        body.plan_tier = String(formData.get('plan_tier') ?? '').trim() || undefined;
    }

    const result = await guarded(() => controller.tenants.create(body));
    if (result.error) return result;

    refreshTenants();
    redirect('/admin/tenants');
}

export async function deleteTenantAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    try {
        await controller.tenants.remove(id);
    } catch (error) {
        if (error instanceof ControllerError) {
            redirect(`/admin/tenants?error=${encodeURIComponent(error.message)}`);
        }
        throw error;
    }
    refreshTenants();
    redirect('/admin/tenants');
}

/**
 * Lifecycle actions. The long-running ones (provision, redeploy, migrate,
 * backup) return an operation id immediately and continue on a Celery worker,
 * so this redirects to the tenant page where progress is polled rather than
 * blocking the request.
 */
export async function tenantLifecycleAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    const action = String(formData.get('action') ?? '');
    if (!id) return;

    const operations: Record<string, () => Promise<unknown>> = {
        provision: () => controller.tenants.provision(id),
        redeploy: () => controller.tenants.redeploy(id),
        stop: () => controller.tenants.stop(id),
        start: () => controller.tenants.start(id),
        'db-migrate': () => controller.tenants.runDbMigrations(id),
        backup: () => controller.tenants.createBackup(id),
    };

    const run = operations[action];
    if (!run) return;

    let operationId: string | undefined;
    try {
        const result = (await run()) as { operation_id?: string } | undefined;
        operationId = result?.operation_id;
    } catch (error) {
        if (error instanceof ControllerError) {
            redirect(`/admin/tenants/${id}?error=${encodeURIComponent(error.message)}`);
        }
        throw error;
    }

    refreshTenants(id);
    const query = operationId
        ? `?operation=${encodeURIComponent(operationId)}`
        : `?done=${encodeURIComponent(action)}`;
    redirect(`/admin/tenants/${id}${query}`);
}

export async function resizeTenantAction(
    id: string,
    _prev: ControllerFormState | undefined,
    formData: FormData,
): Promise<ControllerFormState> {
    await requireAdmin();

    const memory = Number(formData.get('memory_limit_mb') ?? 0);
    const cpu = String(formData.get('cpu_limit_cores') ?? '').trim();
    if (!memory && !cpu) return { error: 'Set a memory or CPU limit to resize.' };

    const result = await guarded(() =>
        controller.tenants.resize(id, {
            ...(memory ? { memory_limit_mb: memory } : {}),
            ...(cpu ? { cpu_limit_cores: cpu } : {}),
        }),
    );
    if (result.error) return result;

    refreshTenants(id);
    redirect(`/admin/tenants/${id}?done=resize`);
}

export async function migrateTenantAction(
    id: string,
    _prev: ControllerFormState | undefined,
    formData: FormData,
): Promise<ControllerFormState> {
    await requireAdmin();

    const targetServerId = String(formData.get('target_server_id') ?? '').trim();
    if (!targetServerId) return { error: 'Choose a destination server.' };

    const result = await guarded(() =>
        controller.tenants.migrate(id, { target_server_id: targetServerId }),
    );
    if (result.error) return result;

    refreshTenants(id);
    redirect(`/admin/tenants/${id}?done=migrate`);
}

export async function addTenantDomainAction(
    id: string,
    _prev: ControllerFormState | undefined,
    formData: FormData,
): Promise<ControllerFormState> {
    await requireAdmin();

    const domain = String(formData.get('domain') ?? '').trim();
    if (!domain) return { error: 'Enter a domain.' };

    const result = await guarded(() =>
        controller.tenants.addDomain(id, {
            domain,
            domain_type: String(formData.get('domain_type') ?? 'custom'),
        }),
    );
    if (result.error) return result;

    refreshTenants(id);
    redirect(`/admin/tenants/${id}?done=domain-added`);
}

export async function domainAction(formData: FormData) {
    await requireAdmin();
    const domainId = String(formData.get('domain_id') ?? '');
    const tenantId = String(formData.get('tenant_id') ?? '');
    const action = String(formData.get('action') ?? '');
    if (!domainId) return;

    const operations: Record<string, () => Promise<unknown>> = {
        activate: () => controller.domains.activate(domainId),
        verify: () => controller.domains.verify(domainId),
        disable: () => controller.domains.disable(domainId),
        remove: () => controller.domains.remove(domainId),
    };

    const run = operations[action];
    if (!run) return;

    try {
        await run();
    } catch (error) {
        if (error instanceof ControllerError) {
            redirect(`/admin/tenants/${tenantId}?error=${encodeURIComponent(error.message)}`);
        }
        throw error;
    }

    refreshTenants(tenantId);
    redirect(`/admin/tenants/${tenantId}?done=${encodeURIComponent(`domain-${action}`)}`);
}

export async function restoreBackupAction(formData: FormData) {
    await requireAdmin();
    const tenantId = String(formData.get('tenant_id') ?? '');
    const backupId = String(formData.get('backup_id') ?? '');
    if (!tenantId || !backupId) return;

    try {
        await controller.tenants.restoreBackup(tenantId, backupId);
    } catch (error) {
        if (error instanceof ControllerError) {
            redirect(`/admin/tenants/${tenantId}?error=${encodeURIComponent(error.message)}`);
        }
        throw error;
    }
    refreshTenants(tenantId);
    redirect(`/admin/tenants/${tenantId}?done=restore`);
}

// --------------------------------------------------------------- databases

function refreshDatabases(id?: string) {
    revalidatePath('/admin/databases');
    if (id) revalidatePath(`/admin/databases/${id}`);
}

function readDatabaseFields(formData: FormData) {
    const engine = String(formData.get('engine') ?? 'postgres') === 'mariadb' ? 'mariadb' : 'postgres';
    const body: Record<string, unknown> = {
        engine,
        name: String(formData.get('name') ?? '').trim(),
        host: String(formData.get('host') ?? '').trim(),
        port: Number(formData.get('port') ?? (engine === 'mariadb' ? 3306 : 5432)),
        database_name: String(formData.get('database_name') ?? '').trim(),
        username: String(formData.get('username') ?? '').trim(),
        sslmode: String(formData.get('sslmode') ?? (engine === 'mariadb' ? 'disable' : 'prefer')),
        role: String(formData.get('role') ?? 'external'),
        host_from_worker: String(formData.get('host_from_worker') ?? '').trim() || null,
        is_default: formData.get('is_default') === 'on',
        allow_writes: formData.get('allow_writes') === 'on',
        notes: String(formData.get('notes') ?? '').trim() || null,
    };
    // An empty password on update means "keep the stored one" — the API
    // only re-encrypts when a non-empty value is sent.
    const password = String(formData.get('password') ?? '');
    if (password) body.password = password;
    return body;
}

export async function createDatabaseAction(
    _prev: ControllerFormState | undefined,
    formData: FormData,
): Promise<ControllerFormState> {
    await requireAdmin();
    const body = readDatabaseFields(formData);

    if (!body.name || !body.host || !body.database_name || !body.username) {
        return { error: 'Name, host, database and username are required.' };
    }
    if (!body.password) return { error: 'A password is required when registering a connection.' };

    const result = await guarded(() => controller.databases.create(body));
    if (result.error) return result;

    refreshDatabases();
    redirect('/admin/databases');
}

export async function updateDatabaseAction(
    id: string,
    _prev: ControllerFormState | undefined,
    formData: FormData,
): Promise<ControllerFormState> {
    await requireAdmin();

    const result = await guarded(() => controller.databases.update(id, readDatabaseFields(formData)));
    if (result.error) return result;

    refreshDatabases(id);
    redirect(`/admin/databases/${id}?done=saved`);
}

export async function deleteDatabaseAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    try {
        await controller.databases.remove(id);
    } catch (error) {
        if (error instanceof ControllerError) {
            redirect(`/admin/databases?error=${encodeURIComponent(error.message)}`);
        }
        throw error;
    }
    refreshDatabases();
    redirect('/admin/databases');
}

export async function testDatabaseAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    let outcome: string;
    try {
        const result = await controller.databases.test(id);
        outcome = result.status === 'success'
            ? `Connected — ${(result.version ?? '').split(' on ')[0] || 'ok'}`
            : result.message ?? 'Connection failed.';
    } catch (error) {
        if (error instanceof ControllerError) {
            redirect(`/admin/databases?error=${encodeURIComponent(error.message)}`);
        }
        throw error;
    }

    refreshDatabases(id);
    redirect(`/admin/databases?tested=${encodeURIComponent(outcome)}`);
}

/**
 * Moves a tenant's data to a different cluster.
 *
 * Unlike the node migration, this physically dumps and restores the tenant's
 * database, so it always runs on a worker and returns an operation to poll.
 */
export async function migrateTenantDatabaseAction(
    id: string,
    _prev: ControllerFormState | undefined,
    formData: FormData,
): Promise<ControllerFormState> {
    await requireAdmin();

    const targetConnectionId = String(formData.get('target_connection_id') ?? '').trim();
    if (!targetConnectionId) return { error: 'Choose a destination cluster.' };

    let operationId: string | undefined;
    try {
        const result = await controller.tenants.migrateDatabase(id, {
            target_connection_id: targetConnectionId,
        });
        operationId = result?.operation_id;
    } catch (error) {
        if (error instanceof ControllerError) return { error: error.message };
        throw error;
    }

    refreshTenants(id);
    redirect(
        `/admin/tenants/${id}${operationId ? `?operation=${encodeURIComponent(operationId)}` : '?done=db-migrate-started'}`,
    );
}

// ---------------------------------------------------------------- polling

export interface OperationSnapshot {
    id: string;
    name: string;
    status: string;
    steps: Array<{ id: string; action: string; status: string; message: string | null }>;
}

/**
 * Reads one operation's current state, for the client-side progress poller.
 *
 * Exposed as a Server Action so the browser can poll without ever holding the
 * controller's internal API key. Returns null instead of throwing when the
 * controller is briefly unreachable, so a blip does not break the poll loop.
 */
export async function fetchOperationAction(operationId: string): Promise<OperationSnapshot | null> {
    await requireAdmin();

    try {
        const { operation, steps } = await controller.logs.operation(operationId);
        return {
            id: operation.id,
            // The API calls this `label`; OperationSnapshot exposes it as `name`.
            name: operation.label,
            status: operation.status,
            steps: (steps ?? []).map((step) => ({
                id: step.id,
                action: step.action,
                status: step.status,
                message: step.message,
            })),
        };
    } catch (error) {
        if (error instanceof ControllerError) return null;
        throw error;
    }
}

// ----------------------------------------------------------------- terminal

/**
 * Mints the short-lived grant the browser presents to the WebSocket terminal
 * service.
 *
 * The terminal is the one part of the controller a browser talks to directly
 * (a WebSocket cannot be proxied through a Server Action), so it cannot use
 * the internal API key. Instead this issues a JWT signed with SESSION_SECRET
 * — shared with the Python service — scoped to a single server and expiring
 * in 60 seconds. See controller/app/terminal/auth.py for the verifier.
 */
export async function mintTerminalTokenAction(serverId: string) {
    const admin = await requireAdmin();

    const secret = process.env.SESSION_SECRET;
    if (!secret) throw new Error('SESSION_SECRET is not set.');

    const token = await new SignJWT({
        purpose: 'controller-terminal',
        serverId,
        adminEmail: admin.email,
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('60s')
        .sign(new TextEncoder().encode(secret));

    return {
        token,
        url: process.env.NEXT_PUBLIC_CONTROLLER_WS_URL ?? 'ws://127.0.0.1:8765',
    };
}

/**
 * Mints the grant the browser presents to the live log/metric stream.
 *
 * Same mechanism as the terminal grant above and the same signing secret, but
 * a different purpose and a different subject: this one names a deployment and
 * a stream kind, so a token issued to tail one storefront's logs cannot be
 * replayed to open a root shell on the node hosting it, nor to read another
 * tenant's output. See controller/app/streams/auth.py for the verifier.
 */
export async function mintStreamTokenAction(
    deploymentId: string,
    kind: 'logs' | 'stats',
) {
    const admin = await requireAdmin();

    const secret = process.env.SESSION_SECRET;
    if (!secret) throw new Error('SESSION_SECRET is not set.');

    const token = await new SignJWT({
        purpose: 'controller-stream',
        deploymentId,
        kind,
        adminEmail: admin.email,
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('60s')
        .sign(new TextEncoder().encode(secret));

    const base = process.env.NEXT_PUBLIC_CONTROLLER_WS_URL ?? 'ws://127.0.0.1:8765';
    return { token, url: `${base}/ws/stream/${kind}/${deploymentId}?token=${encodeURIComponent(token)}` };
}

/**
 * Runs one statement from the database browser.
 *
 * Whether writes are allowed is decided by the connection's `allow_writes`
 * flag on the controller, enforced with a Postgres READ ONLY transaction — not
 * by anything this action sends, and not by inspecting the SQL text. The
 * controller also records every statement to the activity log before running
 * it, so a query that times out is still accounted for.
 *
 * Errors are returned rather than thrown: a syntax error is an ordinary result
 * for a console, not a page crash.
 */
export async function runDatabaseQueryAction(connectionId: string, sql: string): Promise<{
    result?: DbQueryResult;
    error?: string;
}> {
    await requireAdmin();
    if (!sql.trim()) return { error: 'Enter a statement to run.' };
    try {
        return { result: await controller.databases.query(connectionId, sql) };
    } catch (error) {
        if (error instanceof ControllerError) return { error: error.message };
        throw error;
    }
}

export async function forceDeleteSiteAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    if (!id) return;
    try {
        await controller.sites.adminForceDelete(id);
    } catch (error) {
        if (error instanceof ControllerError) {
            redirect(`/admin/sites?error=${encodeURIComponent(error.message)}`);
        }
        throw error;
    }
    revalidatePath('/admin/sites');
    redirect('/admin/sites');
}

const ADMIN_SITE_ACTIONS = ['stop', 'start', 'restart', 'backup', 'deactivate', 'reactivate'] as const;

export async function adminSiteActionAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    const action = String(formData.get('action') ?? '') as (typeof ADMIN_SITE_ACTIONS)[number];
    if (!id || !ADMIN_SITE_ACTIONS.includes(action)) return;
    let notice = `${action} started`;
    try {
        await controller.sites.adminAction(id, action);
    } catch (error) {
        if (!(error instanceof ControllerError)) throw error;
        notice = error.message;
        redirect(`/admin/sites/${id}?error=${encodeURIComponent(notice)}`);
    }
    revalidatePath(`/admin/sites/${id}`);
    redirect(`/admin/sites/${id}?done=${encodeURIComponent(notice)}`);
}
