'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { ExternalLink, GitBranch, Lock, Search, Star } from 'lucide-react';
import { createGithubAppAction, inspectRepositoryAction } from '@/app/admin/app-store-actions';
import type { AppInspection, GithubRepository } from '@/lib/controller-client';
import { compatibilityBadge, shortSha } from '@/lib/app-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

function Submit({ disabled }: { disabled: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending || disabled}>
            {pending ? 'Adding…' : 'Add to App Store'}
        </Button>
    );
}

export function GithubAppForm({
    categories,
    connected,
    repositories,
}: {
    categories: string[];
    connected: boolean;
    repositories: GithubRepository[];
}) {
    const [url, setUrl] = React.useState('');
    const [info, setInfo] = React.useState<AppInspection | null>(null);
    const [problem, setProblem] = React.useState<string | null>(null);
    const [loading, startLoading] = React.useTransition();
    const [state, action] = useActionState(createGithubAppAction, undefined);

    function fetchDetails(branch?: string, address = url) {
        setProblem(null);
        startLoading(async () => {
            const result = await inspectRepositoryAction(address, branch);
            if (result.error || !result.data) {
                setProblem(result.error ?? 'Could not read that repository.');
                if (!branch) setInfo(null);
                return;
            }
            setInfo(result.data);
        });
    }

    const compat = info ? compatibilityBadge(info.compatibility.status) : null;

    return (
        <div className="mt-6 space-y-gap-lg">
            <section className="rounded-xl border border-border p-card">
                {repositories.length > 0 && (
                    <div className="mb-5">
                        <Label>Your repositories</Label>
                        <Select
                            onValueChange={(name) => {
                                const address = `https://github.com/${name}`;
                                setUrl(address);
                                fetchDetails(undefined, address);
                            }}
                        >
                            <SelectTrigger className="mt-2 max-w-xl"><SelectValue placeholder="Choose a repository from your GitHub account…" /></SelectTrigger>
                            <SelectContent>
                                {repositories.map((repo) => (
                                    <SelectItem key={repo.full_name} value={repo.full_name}>
                                        {repo.full_name}{repo.private ? ' (private)' : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                <Label htmlFor="repo-url">{repositories.length > 0 ? 'Or paste a repository address' : 'GitHub repository'}</Label>
                <div className="mt-2 flex flex-wrap gap-3">
                    <Input
                        id="repo-url"
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                if (url.trim()) fetchDetails();
                            }
                        }}
                        placeholder="https://github.com/frappe/hrms"
                        className="min-w-72 flex-1"
                    />
                    <Button type="button" onClick={() => fetchDetails()} disabled={loading || !url.trim()}>
                        <Search className="size-4" />
                        {loading ? 'Reading…' : 'Fetch details'}
                    </Button>
                </div>
                <p className="mt-2 portal-text-caption text-muted-foreground">
                    {connected
                        ? 'The name, description, branches and the Frappe versions the app supports are read from the repository. Private repositories are available through your connected GitHub account.'
                        : <>Public repositories only. <Link href="/admin/apps/github" className="text-primary hover:underline">Connect a GitHub account</Link> to use private repositories.</>}
                </p>
                {problem && <Notice tone="error" className="mt-4">{problem}</Notice>}
            </section>

            {info && (
                <form action={action} className="space-y-gap-lg">
                    <input type="hidden" name="repoUrl" value={info.repo_url} />
                    <section className="rounded-xl border border-border p-card">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg ">{info.title}</h2>
                                <a href={info.html_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 portal-text-caption text-primary hover:underline">
                                    {info.owner}/{info.repo}<ExternalLink className="size-3" />
                                </a>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {info.private && <Badge variant="neutral" dot={false}><Lock className="size-3" />Private</Badge>}
                                {compat && <Badge variant={compat.variant}>{compat.label}</Badge>}
                                <Badge variant="neutral" dot={false}><Star className="size-3" />{info.stars}</Badge>
                                {info.license && <Badge variant="neutral" dot={false}>{info.license}</Badge>}
                            </div>
                        </div>
                        <dl className="mt-4 grid gap-3 portal-text-body sm:grid-cols-2">
                            <div><dt className="text-muted-foreground">Frappe app name</dt><dd className="font-medium">{info.app_name}</dd></div>
                            <div><dt className="text-muted-foreground">Version on this branch</dt><dd className="font-medium">{info.version ?? 'Not declared'}</dd></div>
                            <div><dt className="text-muted-foreground">Latest commit</dt><dd className="font-medium">{shortSha(info.commit.sha)} <span className="font-normal text-muted-foreground">{info.commit.message}</span></dd></div>
                            <div><dt className="text-muted-foreground">Requires Frappe</dt><dd className="font-medium">{info.frappe_range ?? 'Not declared'}</dd></div>
                        </dl>
                        <div className="mt-4 max-w-sm">
                            <Label>Branch</Label>
                            <Select name="branch" value={info.branch} onValueChange={(branch) => fetchDetails(branch)} disabled={loading}>
                                <SelectTrigger className="mt-2"><GitBranch className="size-4" /><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {info.branches.map((branch) => <SelectItem key={branch} value={branch}>{branch}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <p className="mt-1 portal-text-caption text-muted-foreground">Sites get the code on this branch. Choose a release branch such as version-{info.target_majors[0] ?? 16} for production.</p>
                        </div>
                        <Notice
                            tone={info.compatibility.status === 'compatible' ? 'success' : info.compatibility.status === 'incompatible' ? 'error' : 'warning'}
                            className="mt-4"
                        >
                            {info.compatibility.reason}
                            {info.compatibility.status === 'incompatible' && ' You can add it now, but it cannot be installed on a site until a compatible branch is selected.'}
                        </Notice>
                    </section>

                    <section key={info.repo_url + info.app_name} className="portal-fields rounded-xl border border-border p-card">
                        <div className="grid gap-5 sm:grid-cols-2">
                            <div>
                                <Label htmlFor="name">Name</Label>
                                <Input id="name" name="name" defaultValue={info.title} required maxLength={100} className="mt-2" />
                            </div>
                            <div>
                                <Label htmlFor="slug">Slug</Label>
                                <Input id="slug" name="slug" defaultValue={info.app_name.replaceAll('_', '-')} required className="mt-2" />
                            </div>
                            <div>
                                <Label htmlFor="category">Category</Label>
                                <Input id="category" name="category" list="categories" defaultValue={categories[0] ?? 'Business'} required maxLength={50} className="mt-2" />
                                <datalist id="categories">{categories.map((category) => <option key={category} value={category} />)}</datalist>
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" name="description" defaultValue={info.description} required maxLength={2000} className="mt-2" />
                        </div>
                        <label className="flex items-center gap-2 portal-text-body">
                            <input type="checkbox" name="isActive" defaultChecked />
                            Visible in the customer App Store
                        </label>
                        {state?.error && <Notice tone="error">{state.error}</Notice>}
                        <Submit disabled={loading} />
                    </section>
                </form>
            )}
        </div>
    );
}
