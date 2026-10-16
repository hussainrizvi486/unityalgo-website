import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { requireAdmin } from '@/lib/admin-session';
import { controller, ControllerError, type GithubAccount } from '@/lib/controller-client';
import { disconnectGithubAction } from '@/app/admin/app-store-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { ControllerOffline } from '@/components/admin/controller-offline';
import { AdminPageError, AdminPageNotice } from '@/components/admin/page-header';
import { formatDateTime } from '@/lib/admin-format';
import { ConnectForm } from './connect-form';

export const metadata = { title: 'GitHub account' };

export default async function GithubAccountPage({ searchParams }: { searchParams: Promise<{ error?: string; done?: string }> }) {
    await requireAdmin();
    const query = await searchParams;

    let account: GithubAccount;
    try {
        account = await controller.github.account();
    } catch (error) {
        if (error instanceof ControllerError) return <ControllerOffline message={error.message} />;
        throw error;
    }

    return (
        <div className="portal-detail">
            <Link href="/admin/apps" className="mb-6 inline-flex items-center gap-2 portal-text-body font-semibold text-muted-foreground hover:text-foreground/80">
                <ArrowLeft className="h-4 w-4" />Back to App Store
            </Link>
            <h1 className="portal-page-title">GitHub account</h1>
            <p className="mt-1 portal-text-body text-muted-foreground">
                Connect a GitHub account so the App Store can use your private Frappe apps and read GitHub without hitting the anonymous request limit.
            </p>
            {query.error && <AdminPageError message={query.error} />}
            {query.done && <AdminPageNotice message={query.done} />}

            <section className="mt-6 rounded-xl border border-border p-card">
                <div className="flex flex-wrap items-center justify-between gap-gap">
                    {account.connected ? (
                        <div className="flex items-center gap-gap">
                            {account.avatar_url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={account.avatar_url} alt="" className="size-12 rounded-full border border-border" />
                            )}
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-lg font-semibold">{account.name || account.login}</span>
                                    {account.problem ? <Badge variant="error">Token not accepted</Badge> : <Badge variant="success">Connected</Badge>}
                                </div>
                                {account.html_url && (
                                    <a href={account.html_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 portal-text-caption text-primary hover:underline">
                                        @{account.login}<ExternalLink className="size-3" />
                                    </a>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center gap-2"><span className="text-lg font-semibold">Not connected</span><Badge variant="neutral">Public repositories only</Badge></div>
                            <p className="portal-text-caption text-muted-foreground">Anonymous access is limited to 60 GitHub requests an hour.</p>
                        </div>
                    )}
                    {account.source === 'account' && (
                        <form action={disconnectGithubAction}>
                            <Button type="submit" variant="outline" size="sm">Disconnect</Button>
                        </form>
                    )}
                </div>

                {account.problem && <Notice tone="error" className="mt-4">{account.problem}</Notice>}
                {account.source === 'environment' && (
                    <Notice tone="info" className="mt-4">
                        This connection comes from the controller&rsquo;s GITHUB_TOKEN setting. Connect an account below to replace it.
                    </Notice>
                )}
                {account.connected && !account.problem && (
                    <dl className="mt-4 grid gap-3 portal-text-body sm:grid-cols-2 lg:grid-cols-4">
                        <div><dt className="text-muted-foreground">Access</dt><dd className="font-medium">{account.scopes || 'Fine-grained token'}</dd></div>
                        <div><dt className="text-muted-foreground">Requests left this hour</dt><dd className="font-medium">{account.rate_remaining ?? '—'}{account.rate_limit ? ` of ${account.rate_limit}` : ''}</dd></div>
                        <div><dt className="text-muted-foreground">Connected</dt><dd className="font-medium">{account.connected_at ? formatDateTime(account.connected_at) : '—'}</dd></div>
                        <div><dt className="text-muted-foreground">Connected by</dt><dd className="font-medium">{account.connected_by ?? '—'}</dd></div>
                    </dl>
                )}
            </section>

            <section className="mt-4 rounded-xl border border-border p-card">
                <h2 className="">{account.source === 'account' ? 'Replace the token' : 'Connect with a personal access token'}</h2>
                <ol className="mt-3 list-decimal space-y-1 pl-5 portal-text-body text-foreground/70">
                    <li>
                        Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">GitHub &rarr; Settings &rarr; Fine-grained tokens</a> and create a token.
                    </li>
                    <li>Under <em>Repository access</em> choose the repositories (or all) that hold your Frappe apps.</li>
                    <li>Under <em>Permissions</em> grant read-only <strong>Contents</strong>. Metadata is added automatically. Nothing else is needed.</li>
                    <li>Paste the token below. A classic token with the <code>repo</code> scope also works.</li>
                </ol>
                <ConnectForm />
                <p className="mt-4 portal-text-caption text-muted-foreground">
                    The token is checked with GitHub, then stored encrypted. It is used to read repository details and to download code onto a worker while a site is updated;
                    it is never put in a site&rsquo;s image or shown in logs.
                </p>
            </section>
        </div>
    );
}
