'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { completeTourAction } from '@/app/dashboard/actions';
import { cn } from '@/utils';

interface TourStep {
    /** CSS selector of what to point at. Without one (or when it is not on screen) the step is a centred card. */
    target?: string;
    title: string;
    body: string;
    cta?: { label: string; href: string };
}

const nav = (href: string) => `[data-slot="sidebar"] a[href="${href}"]`;

const STEPS: TourStep[] = [
    { title: 'Welcome to your portal', body: 'A one-minute tour of where things are. You can skip it any time and replay it later from the ? button at the top.' },
    { target: nav('/dashboard/sites'), title: 'Sites', body: 'Create an AlgoSuite site and watch it deploy. Once it is live you can start, stop and restart it, change the admin password, take backups, add your own domain and see how it is performing.' },
    { target: nav('/dashboard/app-store'), title: 'App Store', body: 'Add apps to a site in a click. Paid apps are added to your subscription and stop being charged when you remove them.' },
    { target: nav('/dashboard/plans'), title: 'Plans', body: 'Compare plans. Some include a free trial: a site on a trial is switched off when it ends unless you subscribe, and your data is kept.' },
    { target: nav('/dashboard/subscription'), title: 'Subscription', body: 'Your current plan, add-ons, renewal date and invoices.' },
    { target: nav('/dashboard/support'), title: 'Support', body: 'Open a ticket and follow the replies here.' },
    { target: nav('/dashboard/settings'), title: 'Settings', body: 'Your profile, password, saved addresses and the devices signed in to your account.' },
    { target: '[data-tour="notifications"]', title: 'Notifications', body: 'Site progress, trial reminders and billing notices show up here.' },
    { target: '[data-tour="theme"]', title: 'Light or dark', body: 'Switch the look of the portal to suit you.' },
    { title: 'You are all set', body: 'The quickest way to see it work is to create your first site.', cta: { label: 'Create your first site', href: '/dashboard/sites/new' } },
];

const PAD = 6;
const GAP = 12;

interface Placement {
    spot: { top: number; left: number; width: number; height: number } | null;
    card: { top: number; left: number };
}

function visibleTarget(selector?: string) {
    if (!selector) return null;
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const onScreen = rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < window.innerWidth && rect.bottom > 0 && rect.top < window.innerHeight;
    return onScreen ? { element, rect } : null;
}

function place(target: ReturnType<typeof visibleTarget>, card: { width: number; height: number }): Placement {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!target) return { spot: null, card: { top: Math.max(GAP, (vh - card.height) / 2), left: Math.max(GAP, (vw - card.width) / 2) } };
    const { rect } = target;
    const spot = { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 };
    // To the right of the target when there is room (the sidebar), otherwise below it, kept inside the window.
    let top: number;
    let left: number;
    if (rect.right + GAP + card.width < vw) {
        left = rect.right + PAD + GAP;
        top = rect.top + rect.height / 2 - card.height / 2;
    } else {
        left = rect.right - card.width;
        top = rect.bottom + PAD + GAP;
    }
    return { spot, card: { top: Math.min(Math.max(GAP, top), vh - card.height - GAP), left: Math.min(Math.max(GAP, left), vw - card.width - GAP) } };
}

/**
 * A guided tour of the portal: dims the page, lights up one thing at a time and says what it is for. It starts by itself
 * once for a new customer and can be replayed from the ? button. Skipping or finishing is remembered on the account.
 */
export function ProductTour({ autoStart }: { autoStart: boolean }) {
    const pathname = usePathname();
    const [open, setOpen] = React.useState(false);
    const [index, setIndex] = React.useState(0);
    const [placement, setPlacement] = React.useState<Placement | null>(null);
    const cardRef = React.useRef<HTMLDivElement>(null);
    const nextRef = React.useRef<HTMLButtonElement>(null);
    const remembered = React.useRef(!autoStart);
    const step = STEPS[index];
    const last = index === STEPS.length - 1;

    React.useEffect(() => {
        if (!autoStart || pathname !== '/dashboard') return;
        const timer = setTimeout(() => setOpen(true), 900);
        return () => clearTimeout(timer);
    }, [autoStart, pathname]);

    const close = React.useCallback(() => {
        setOpen(false);
        setIndex(0);
        if (!remembered.current) {
            remembered.current = true;
            void completeTourAction();
        }
    }, []);

    const layout = React.useCallback(() => {
        const card = cardRef.current;
        if (!card) return;
        const target = visibleTarget(step.target);
        target?.element.scrollIntoView({ block: 'nearest' });
        setPlacement(place(visibleTarget(step.target), { width: card.offsetWidth, height: card.offsetHeight }));
    }, [step.target]);

    React.useLayoutEffect(() => {
        if (!open) return;
        layout();
        window.addEventListener('resize', layout);
        window.addEventListener('scroll', layout, true);
        return () => {
            window.removeEventListener('resize', layout);
            window.removeEventListener('scroll', layout, true);
        };
    }, [open, index, layout]);

    React.useEffect(() => {
        if (open) nextRef.current?.focus();
    }, [open, index]);

    React.useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') close();
            else if (event.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, STEPS.length - 1));
            else if (event.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, close]);

    return (
        <>
            <Button type="button" variant="ghost" size="icon" aria-label="Take the portal tour" title="Take the portal tour" onClick={() => { setIndex(0); setOpen(true); }}>
                <CircleHelp className="size-5" />
            </Button>

            {open && (
                <div className="fixed inset-0 z-[var(--layer-overlay)]" role="presentation">
                    {/* Blocks clicks on the page behind and dims it; around the target a hole is cut by the shadow below. */}
                    <div className="absolute inset-0" onClick={close} />
                    {placement?.spot ? (
                        <div
                            aria-hidden
                            className="pointer-events-none absolute rounded-lg ring-2 ring-primary transition-all duration-300 motion-reduce:transition-none"
                            style={{ ...placement.spot, boxShadow: '0 0 0 100vmax color-mix(in srgb, var(--scrim) 55%, transparent)' }}
                        />
                    ) : (
                        <div aria-hidden className="pointer-events-none absolute inset-0 bg-scrim/55" />
                    )}

                    <div
                        ref={cardRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="tour-title"
                        aria-describedby="tour-body"
                        className={cn(
                            'absolute z-[var(--layer-tooltip)] rounded-xl border border-border bg-popover p-card text-popover-foreground shadow-lg transition-[top,left] duration-300 motion-reduce:transition-none',
                            !placement && 'invisible',
                        )}
                        style={{ width: 'min(22rem, calc(100vw - 2 * var(--gap)))', top: placement?.card.top ?? 0, left: placement?.card.left ?? 0 }}
                    >
                        <p className="portal-text-caption text-muted-foreground">Step {index + 1} of {STEPS.length}</p>
                        <h2 id="tour-title" className="mt-1">{step.title}</h2>
                        <p id="tour-body" className="mt-2 portal-text-body text-foreground/80">{step.body}</p>

                        <div className="mt-4 flex items-center gap-1.5" aria-hidden>
                            {STEPS.map((_, i) => <span key={i} className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-4 bg-primary' : 'w-1.5 bg-border')} />)}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                            <Button type="button" variant="ghost" size="sm" onClick={close}>{last ? 'Close' : 'Skip tour'}</Button>
                            <div className="flex items-center gap-2">
                                {index > 0 && <Button type="button" variant="outline" size="sm" onClick={() => setIndex(index - 1)}>Back</Button>}
                                {last && step.cta ? (
                                    <Button asChild size="sm" ref={nextRef}><Link href={step.cta.href} onClick={close}>{step.cta.label}</Link></Button>
                                ) : (
                                    <Button ref={nextRef} type="button" size="sm" onClick={() => (last ? close() : setIndex(index + 1))}>{last ? 'Finish' : 'Next'}</Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
