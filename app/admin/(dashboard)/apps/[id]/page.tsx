import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { ArrowLeft, ArrowUpRight, RefreshCw, ScanSearch } from 'lucide-react';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-session';
import { controller, ControllerError, type AppInstallation, type AppRollout } from '@/lib/controller-client';
import { changeAppBranchAction, deleteAppAction, refreshGithubAppAction, scanSitesAction } from '@/app/admin/app-store-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DeleteButton } from '@/components/admin/delete-button';
import { AdminPageError, AdminPageNotice } from '@/components/admin/page-header';
import { Notice } from '@/components/ui/notice';
import { formatDateTime } from '@/lib/admin-format';
import { ISOLATION_NOTE, compatibilityBadge, repoPath, rolloutBadge, shortSha } from '@/lib/app-store';
import { AppCatalogForm } from '../app-form';
import { BranchPicker } from './branch-picker';
import { RolloutPanel } from './rollout-panel';

export const metadata = { title: 'Application' };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-xl border border-border p-card">
            <h2 className="">{title}</h2>
            <dl className="mt-3 space-y-2 portal-text-body">{children}</dl>
        </section>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-gap">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-all text-right font-medium">{children}</dd>
        </div>
    );
}

export default async function AppDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ error?: string; done?: string }>;
}) {
    await requireAdmin();
    const { id } = await params;
    const query = await searchParams;
    const app = await db.query.appCatalog.findFirst({ where: eq(schema.appCatalog.id, id) });
    if (!app) notFound();

    const github = app.source === 'github' && !!app.repoUrl && !!app.frappeAppName;
    let sites: AppInstallation[] = [];
    let history: AppRollout[] = [];
    let controllerProblem: string | null = null;
    if (app.frappeAppName) {
        try {
            [sites, history] = await Promise.all([
                controller.apps.installations(app.frappeAppName, github ? app.repoUrl : null, github ? app.branch : null).then((r) => r.results),
                github ? controller.apps.rollouts(app.frappeAppName).then((r) => r.results) : Promise.resolve([]),
            ]);
        } catch (error) {
            if (!(error instanceof ControllerError)) throw error;
            controllerProblem = error.message;
        }
    }

    const compat = compatibilityBadge(app.compatibility);
    const installed = sites.filter((site) => site.installed);
    const behind = installed.filter((site) => site.installed?.up_to_date === false).length;
    const blocked = !github ? 'This app is built into the platform image and is updated with it.'
        : app.compatibility === 'incompatible' ? `${app.compatibilityNote} Choose a compatible branch before installing or updating.`
        : null;

    return (
        <div className="portal-detail">
            <Link href="/admin/apps" className="mb-6 inline-flex items-center gap-2 portal-text-body font-semibold text-muted-foreground hover:text-foreground/80">
                <ArrowLeft className="h-4 w-4" />Back to App Store
            </Link>
            <div className="flex flex-wrap items-start justify-between gap-gap">
                <div>
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="portal-page-title">{app.name}</h1>
                        <Badge variant={app.isActive ? 'success' : 'neutral'}>{app.isActive ? 'Visible' : 'Hidden'}</Badge>
                        {github ? <Badge variant={compat.variant}>{compat.label}</Badge> : <Badge variant="neutral">Built in</Badge>}
                    </div>
                    <p className="mt-1 portal-text-body text-muted-foreground">{app.category}{app.frappeAppName ? ` · ${app.frappeAppName}` : ''}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {github && (
                        <>
                            <form action={refreshGithubAppAction}>
                                <input type="hidden" name="id" value={app.id} />
                                <Button type="submit" size="sm"><RefreshCw className="size-4" />Check for updates</Button>
                            </form>
                            <Button asChild size="sm" variant="outline">
                                <a href={app.repoUrl!} target="_blank" rel="noopener noreferrer">GitHub <ArrowUpRight className="size-4" /></a>
                            </Button>
                        </>
                    )}
                    <form action={scanSitesAction}>
                        <input type="hidden" name="id" value={app.id} />
                        <Button type="submit" size="sm" variant="outline"><ScanSearch className="size-4" />Rescan sites</Button>
                    </form>
                </div>
            </div>
            {query.error && <AdminPageError message={query.error} />}
            {query.done && <AdminPageNotice message={query.done} />}
            {controllerProblem && <AdminPageError message={`Site information is unavailable: ${controllerProblem}`} />}

            {github && (
                <div className="mt-6 grid gap-gap md:grid-cols-2 xl:grid-cols-3">
                    <Card title="Source">
                        <Row label="Repository"><a href={app.repoUrl!} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{repoPath(app.repoUrl)}</a></Row>
                        <Row label="Publisher">{app.publisher ?? '—'}</Row>
                        <Row label="Default branch">{app.defaultBranch ?? '—'}</Row>
                        <Row label="Tracked branch">
                            <BranchPicker appId={app.id} current={app.branch ?? ''} branches={app.branches} action={changeAppBranchAction} />
                        </Row>
                    </Card>
                    <Card title="Latest on GitHub">
                        <Row label="Version">{app.latestVersion ?? 'Not declared'}</Row>
                        <Row label="Commit">{shortSha(app.latestCommit)}</Row>
                        <Row label="Message">{app.latestCommitMessage ?? '—'}</Row>
                        <Row label="Committed">{formatDateTime(app.latestCommitAt)}</Row>
                        <Row label="Last checked">{app.lastCheckedAt ? formatDateTime(app.lastCheckedAt) : 'Never'}</Row>
                    </Card>
                    <Card title="Frappe compatibility">
                        <Row label="Status"><Badge variant={compat.variant}>{compat.label}</Badge></Row>
                        <Row label="App requires">{app.frappeRange ?? 'Not declared'}</Row>
                        <Row label="Installed on">{installed.length} site{installed.length === 1 ? '' : 's'}</Row>
                        <Row label="Needing an update">{behind}</Row>
                        <p className="portal-text-caption text-muted-foreground">{app.compatibilityNote}</p>
                    </Card>
                </div>
            )}

            <section className="mt-8">
                <h2 className="text-lg ">{github ? 'Roll out to sites' : 'Sites running this app'}</h2>
                {github && <Notice tone="info" className="mt-3">{ISOLATION_NOTE}</Notice>}
                <div className="mt-4">
                    {app.frappeAppName ? (
                        <RolloutPanel
                            appId={app.id}
                            appTitle={app.name}
                            sites={sites}
                            blocked={controllerProblem ? 'Site information is unavailable, so a rollout cannot be started.' : blocked}
                            unverified={app.compatibility === 'unknown'}
                        />
                    ) : (
                        <p className="portal-text-body text-muted-foreground">This application has no Frappe app name, so it cannot be installed on sites.</p>
                    )}
                </div>
            </section>

            {github && (
                <section className="mt-8">
                    <h2 className="text-lg ">Rollout history</h2>
                    {history.length === 0 ? (
                        <p className="mt-2 portal-text-body text-muted-foreground">Nothing has been rolled out yet.</p>
                    ) : (
                        <div className="mt-3 divide-y divide-border/60 rounded-xl border border-border">
                            {history.map((rollout) => {
                                const badge = rolloutBadge(rollout.status);
                                return (
                                    <Link key={rollout.id} href={`/admin/apps/rollouts/${rollout.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-muted">
                                        <div>
                                            <div className="font-medium">
                                                {rollout.action === 'install' ? 'Install' : 'Update'} to {rollout.target_version ?? shortSha(rollout.target_commit)}
                                                <span className="font-normal text-muted-foreground"> · {rollout.branch} @ {shortSha(rollout.target_commit)}</span>
                                            </div>
                                            <div className="portal-text-caption text-muted-foreground">
                                                {formatDateTime(rollout.created_at)}{rollout.created_by ? ` · ${rollout.created_by}` : ''}
                                                {rollout.note ? ` · ${rollout.note}` : ''}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 portal-text-caption text-muted-foreground">
                                            <span>{rollout.counts.success}/{rollout.site_count} done{rollout.counts.failed ? ` · ${rollout.counts.failed} failed` : ''}{rollout.counts.skipped ? ` · ${rollout.counts.skipped} skipped` : ''}</span>
                                            <Badge variant={badge.variant}>{badge.label}</Badge>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}

            <section className="mt-8 rounded-xl border border-border p-card">
                <h2 className="">Details</h2>
                <AppCatalogForm app={app} github={github} />
            </section>

            <section className="mt-4 flex flex-wrap items-center justify-between gap-gap rounded-xl border border-border p-card">
                <div>
                    <h2 className="">Remove from the App Store</h2>
                    <p className="portal-text-caption text-muted-foreground">
                        Removes the listing only. {github ? 'An app installed on a site must be hidden instead; sites keep what they have.' : 'Sites keep any app already installed.'}
                    </p>
                </div>
                <DeleteButton
                    action={deleteAppAction}
                    id={app.id}
                    title={`Remove ${app.name}?`}
                    description="The application disappears from the App Store. Sites that already run it are not changed."
                />
            </section>
        </div>
    );
}
