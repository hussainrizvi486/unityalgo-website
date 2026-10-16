'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, Globe, LoaderCircle, ShieldCheck, Trash2 } from 'lucide-react';
import type { CustomerSite, SiteDomain, SiteDomains } from '@/lib/controller-client';
import { addDomainAction, removeDomainAction, verifyDomainAction } from '../../actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { FormField } from '@/components/ui/form-field';

function Go({ children, variant = 'outline', icon }: { children: React.ReactNode; variant?: 'outline' | 'default'; icon?: React.ReactNode }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" size="sm" variant={variant} disabled={pending}>
            {pending ? <LoaderCircle className="size-4 motion-safe:animate-spin" /> : icon}
            {children}
        </Button>
    );
}

function Row({ site, domain, onChange }: { site: CustomerSite; domain: SiteDomain; onChange: () => void }) {
    const [verify, verifyAction] = useActionState(verifyDomainAction, undefined);
    const [remove, removeAction] = useActionState(removeDomainAction, undefined);
    const seen = useRef<[unknown, unknown]>([verify, remove]);
    useEffect(() => {
        if (verify !== seen.current[0] || remove !== seen.current[1]) {
            seen.current = [verify, remove];
            onChange();
        }
    }, [verify, remove, onChange]);
    const live = domain.status === 'active';
    const message = verify?.error ?? domain.error;
    return (
        <li className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <span>
                    <span className="flex flex-wrap items-center gap-2 font-mono portal-text-body">
                        {domain.domain}
                        <Badge variant={live ? 'success' : 'warning'}>{live ? 'DNS verified' : 'Waiting for DNS'}</Badge>
                        {live && (
                            <Badge variant={domain.tls_status === 'active' ? 'success' : 'neutral'}>
                                <ShieldCheck className="mr-1 size-3" />
                                {domain.tls_status === 'active' ? 'HTTPS active' : 'Certificate pending'}
                            </Badge>
                        )}
                    </span>
                </span>
                <span className="flex gap-2">
                    {!live && (
                        <form action={verifyAction}>
                            <input type="hidden" name="siteId" value={site.id} />
                            <input type="hidden" name="domainId" value={domain.id} />
                            <Go variant="default" icon={<Check className="size-4" />}>Verify DNS</Go>
                        </form>
                    )}
                    <form action={removeAction}>
                        <input type="hidden" name="siteId" value={site.id} />
                        <input type="hidden" name="domainId" value={domain.id} />
                        <Go icon={<Trash2 className="size-4" />}>Remove</Go>
                    </form>
                </span>
            </div>
            {!live && message && <p role="alert" className="mt-2 text-xs text-foreground/70">{message}</p>}
            {verify?.success && <p className="mt-2 text-xs text-success">{verify.success}</p>}
        </li>
    );
}

export function SiteDomainsPanel({ site }: { site: CustomerSite }) {
    const [data, setData] = useState<SiteDomains | null>(null);
    const [error, setError] = useState(false);
    const [version, setVersion] = useState(0);
    // Refresh the list from inside the action, once the domain is saved. React 19 also clears the
    // (uncontrolled) input after a successful submit, so there is nothing to reset by hand.
    const [state, addAction] = useActionState(async (previous: Awaited<ReturnType<typeof addDomainAction>> | undefined, form: FormData) => {
        const result = await addDomainAction(previous, form);
        if (result.success) setVersion((v) => v + 1);
        return result;
    }, undefined);
    useEffect(() => {
        const abort = new AbortController();
        fetch(`/api/customer/sites/${site.id}/domains`, { signal: abort.signal })
            .then((response) => (response.ok ? response.json() : Promise.reject()))
            .then((value: SiteDomains) => { setData(value); setError(false); })
            .catch(() => { if (!abort.signal.aborted) setError(true); });
        return () => abort.abort();
    }, [site.id, version]);
    const refresh = () => setVersion((v) => v + 1);
    const pending = data?.results.some((domain) => domain.status === 'pending');
    const full = data ? data.results.length >= data.limit : false;
    return (
        <section className="rounded-xl border border-border p-card">
            <h2 className="">Domains &amp; SSL</h2>
            <p className="mt-1 portal-text-caption text-muted-foreground">
                Use your own domain for this site. HTTPS certificates are issued and renewed for you.
            </p>
            <div className="mt-4 rounded-lg bg-muted p-4 portal-text-body">
                <p className="flex items-center gap-2 font-medium"><Globe className="size-4" />Default address</p>
                <p className="mt-1 break-all font-mono text-foreground/80">{site.domain}</p>
            </div>

            <form action={addAction} className="mt-5 flex flex-wrap items-end gap-3">
                <input type="hidden" name="siteId" value={site.id} />
                <FormField id="domain" label="Add a domain" className="min-w-64 flex-1" error={state?.error} help="For example erp.yourcompany.com">
                    <Input id="domain" name="domain" autoComplete="off" disabled={full} placeholder="erp.yourcompany.com" />
                </FormField>
                <div className="pb-5.5"><Go variant="default">Add domain</Go></div>
            </form>
            {full && <p className="mt-2 portal-text-caption text-muted-foreground">You have reached the limit of {data?.limit} domains.</p>}

            {pending && data && (
                <Notice tone="info" className="mt-5">
                    At your DNS provider, create <strong>one</strong> of these records for each domain, then press Verify (DNS changes can take a few minutes):
                    <span className="mt-2 block font-mono text-xs leading-6">
                        CNAME &nbsp;→&nbsp; {data.target}
                        {data.proxy_ips.length > 0 && <><br />A &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;→&nbsp; {data.proxy_ips.join(', ')}</>}
                    </span>
                </Notice>
            )}

            {error && <p className="mt-4 portal-text-body text-muted-foreground">Domains could not be loaded right now.</p>}
            {data && (data.results.length ? (
                <ul className="mt-4 divide-y divide-border/60">
                    {data.results.map((domain) => <Row key={domain.id} site={site} domain={domain} onChange={refresh} />)}
                </ul>
            ) : (
                <p className="mt-4 portal-text-body text-muted-foreground">No custom domains yet.</p>
            ))}
        </section>
    );
}
