'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
    ArrowRight,
    Check,
    CheckCircle2,
    Headphones,
    ImageIcon,
    LayoutTemplate,
    LockKeyhole,
    Server,
    ShieldCheck,
    Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils';

export interface UnityCommercePlan {
    name: string;
    /** Pre-formatted in the plan's own currency, or null for a custom quote. */
    monthlyPrice: string | null;
    annualPrice: string | null;
    audience: string;
    features: string[];
    highlighted: boolean;
}

const commerceHighlights = [
    { icon: LayoutTemplate, title: 'Build your store effortlessly', text: 'Pick a theme and publish from the visual editor — no code.' },
    { icon: Server, title: 'Hassle-free hosting', text: 'Secure cloud hosting, SSL and platform updates included.' },
    { icon: ShieldCheck, title: 'Encrypted checkout', text: 'Bank-grade SSL security on every sale.' },
    { icon: Headphones, title: '24/7 local support', text: 'Direct help when your business needs it.' },
];

/** The ten themes included with every plan. Artwork is still to come. */
const themes = [
    { name: 'Aurora', tag: 'Fashion & Apparel' },
    { name: 'Meridian', tag: 'Minimal / Editorial' },
    { name: 'Bazaar', tag: 'Multi-category' },
    { name: 'Atelier', tag: 'Jewellery & Luxury' },
    { name: 'Harvest', tag: 'Grocery & Fresh' },
    { name: 'Kinetic', tag: 'Electronics' },
    { name: 'Bloom', tag: 'Beauty & Skincare' },
    { name: 'Foundry', tag: 'Home & Furniture' },
    { name: 'Verve', tag: 'Sports & Outdoor' },
    { name: 'Paper', tag: 'Books & Stationery' },
];

const launchSteps = [
    {
        step: '01',
        title: 'Add your first product',
        text: 'Upload photos, set prices and stock, and organise everything into collections your customers can actually browse.',
        image: '/images/add-products.avif',
    },
    {
        step: '02',
        title: 'Customize your store',
        text: 'Pick a theme, then change colours, fonts, banners and sections in the visual editor. No code, no developer, no waiting.',
        image: '/images/customize-store.jpg',
    },
    {
        step: '03',
        title: 'Set up payments',
        text: 'Switch on cash on delivery, bank transfer and local gateways — and keep every rupee, because we take 0% of your sales.',
        image: '/images/setup-payments.jpg',
    },
];

function ImagePlaceholder({
    label,
    tone = 'dark',
    className,
}: {
    label: string;
    /** Which ground it sits on — the page alternates white and near-black. */
    tone?: 'dark' | 'light';
    className?: string;
}) {
    const light = tone === 'light';
    return (
        <div
            className={cn(
                'flex h-full w-full flex-col items-center justify-center gap-2 border border-dashed',
                light ? 'border-input bg-muted' : 'border-primary-foreground/15 bg-card/[0.03]',
                light
                    ? '[background-image:repeating-linear-gradient(45deg,color-mix(in_srgb,var(--scrim)_3.5%,transparent)_0_10px,transparent_10px_20px)]'
                    : '[background-image:repeating-linear-gradient(45deg,color-mix(in_srgb,var(--on-scrim)_3%,transparent)_0_10px,transparent_10px_20px)]',
                className,
            )}
        >
            <ImageIcon className={cn('size-6', light ? 'text-muted-foreground/50' : 'text-primary-foreground/25')} />
            <span className={cn(
                'px-4 text-center text-small font-medium uppercase tracking-wider',
                light ? 'text-muted-foreground' : 'text-primary-foreground/35',
            )}>
                {label}
            </span>
        </div>
    );
}

export const MainContent = ({ plans }: { plans: UnityCommercePlan[] }) => {
    return (
        <main className="relative bg-card text-foreground">
            {/* ── HERO ────────────────────────────────────────────────── */}
            <section className="relative isolate overflow-hidden px-page pb-section pt-hero sm:pb-section">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_15%,color-mix(in_srgb,var(--scrim)_7%,transparent),transparent_45%),radial-gradient(circle_at_15%_85%,color-mix(in_srgb,var(--scrim)_4%,transparent),transparent_40%)]" />
                <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-40 [mask-image:linear-gradient(to_bottom,var(--scrim)_35%,transparent_90%)]" />

                <div className="site-container relative">
                    <div className="flex flex-col items-center text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold tracking-wide text-foreground/80 shadow-sm backdrop-blur-md"
                        >
                            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <Sparkles className="size-3" />
                            </span>
                            <span>The Next-Gen Store Builder for Modern Brands</span>
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="mt-6 max-w-detail text-balance text-4xl font-extrabold leading-none tracking-tighter sm:text-6xl lg:text-7xl"
                        >
                            Build the brand you&rsquo;ve{' '}
                            <span className="bg-gradient-to-r from-muted-foreground via-primary to-muted-foreground bg-clip-text text-transparent">
                                always dreamed of.
                            </span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="mt-6 max-w-2xl text-balance text-base leading-relaxed text-foreground/70 sm:text-xl"
                        >
                            Launch a high-converting storefront, deliver 2-minute checkout experiences, and manage orders,
                            inventory and WhatsApp sales with zero platform transaction fees.
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                            className="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row"
                        >
                            <Button asChild size="lg" className="group h-13 w-full bg-primary px-8 text-base font-semibold text-primary-foreground shadow-lg shadow-foreground/20 transition-all hover:bg-primary/90 hover:shadow-xl sm:w-auto"><Link href="/register?next=/customer/onboarding&plan=Growth" className="w-full sm:w-auto">
                                    Start Building Your Store
                                    <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                                </Link></Button>
                            <Button asChild variant="outline" size="lg" className="h-13 w-full border-input bg-card px-8 text-base font-semibold text-foreground shadow-sm hover:bg-muted hover:text-foreground sm:w-auto"><Link href="#pricing" className="w-full sm:w-auto">
                                    View Pricing &amp; Plans
                                </Link></Button>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.6, delay: 0.4 }}
                            className="mt-8 flex flex-wrap items-center justify-center gap-gap-lg text-xs font-semibold text-foreground/70 sm:text-sm"
                        >
                            {['0% Transaction Fees', '10 Free Premium Themes', 'Mobile & COD Ready', 'Free SSL & Domain Support'].map((claim) => (
                                <span key={claim} className="flex items-center gap-2">
                                    <CheckCircle2 className="size-4 text-foreground" />
                                    {claim}
                                </span>
                            ))}
                        </motion.div>
                    </div>

                    {/* Store mockup — browser chrome around placeholder artwork. */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className="relative mx-auto mt-14 max-w-wide"
                    >
                        <div className="absolute -inset-4 rounded-[calc(var(--radius)*7)] bg-gradient-to-r from-primary/10 via-primary/[0.02] to-primary/10 blur-3xl" />

                        <div className="relative rounded-xl border border-border bg-card p-2.5 shadow-xl sm:p-4 md:rounded-2xl">
                            <div className="mb-3 flex items-center justify-between border-b border-border/60 px-2 pb-3">
                                <div className="flex items-center gap-2">
                                    <span className="size-3 rounded-full bg-border" />
                                    <span className="size-3 rounded-full bg-border" />
                                    <span className="size-3 rounded-full bg-border" />
                                </div>
                                <div className="flex w-full max-w-sm items-center justify-center gap-2 rounded-md border border-border bg-muted px-4 py-1.5 text-xs font-medium text-muted-foreground">
                                    <LockKeyhole className="size-3 text-muted-foreground" />
                                    <span>https://your-store.com</span>
                                </div>
                                <div className="hidden items-center gap-2 sm:flex">
                                    <span className="rounded-full bg-secondary px-2.5 py-1 text-micro font-bold text-foreground/70">Preview</span>
                                </div>
                            </div>

                            <div className="relative aspect-[16/9.5] overflow-hidden rounded-lg">
                                <ImagePlaceholder label="Storefront mockup — 1600 × 950" tone="light" />

                                {/* Portrait phone, overlapping the desktop frame. */}
                                <div className="absolute -bottom-4 right-4 w-36 overflow-hidden rounded-3xl border-4 border-foreground bg-primary shadow-2xl sm:right-8 sm:w-56 sm:rounded-3xl sm:border-6 md:w-64">
                                    <div className="relative aspect-[9/18.5] w-full">
                                        <ImagePlaceholder label="Mobile" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    <div className="mt-16 grid gap-gap border-t border-border pt-8 sm:grid-cols-2 lg:grid-cols-4">
                        {commerceHighlights.map((highlight) => (
                            <div key={highlight.title} className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-4 shadow-sm">
                                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
                                    <highlight.icon className="size-5" />
                                </span>
                                <div>
                                    <p className="text-sm font-bold text-foreground">{highlight.title}</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">{highlight.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── THEMES PREVIEW ──────────────────────────────────────── */}
            <section id="themes" className="scroll-mt-20 bg-primary px-page text-primary-foreground site-section-spacing">
                <div className="site-container">
                    <div className="mb-14 max-w-3xl">
                        <span className="text-xs font-extrabold uppercase tracking-eyebrow text-primary-foreground/50">Included with every plan</span>
                        <h2 className="mt-2 text-3xl tracking-tight sm:text-5xl">
                            Featured Free Premium Themes
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-primary-foreground/60 sm:text-base">
                            Every theme is mobile-responsive and editable in the visual editor — change colours, fonts,
                            banners and sections without touching code. No premium theme fees, ever.
                        </p>
                    </div>

                    {}
                    <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
                        {themes.map((theme, index) => (
                            <motion.div
                                key={theme.name}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-80px' }}
                                transition={{ delay: (index % 4) * 0.06 }}
                                className="group overflow-hidden rounded-2xl border border-primary-foreground/10 bg-card/[0.03] transition-colors hover:border-primary-foreground/30"
                            >
                                <div className="relative aspect-3/4 overflow-hidden">
                                    <ImagePlaceholder label={`${theme.name} preview`} className="border-0" />
                                </div>
                                <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-primary-foreground">{theme.name}</p>
                                        <p className="truncate text-xs text-primary-foreground/45">{theme.tag}</p>
                                    </div>
                                    <ArrowRight className="size-4 shrink-0 text-primary-foreground/25 transition-all group-hover:translate-x-0.5 group-hover:text-primary-foreground" />
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="mt-10 flex flex-wrap items-center gap-gap">
                        {}
                        <p className="text-xs text-primary-foreground/45">Switch themes at any time — your products and orders stay put.</p>
                    </div>
                </div>
            </section>

            {}
            <section id="pricing" className="scroll-mt-20 border-t border-border/60 site-section-spacing">
                <div className="site-container px-4">
                    <div className="mb-12 text-center">
                        <span className="text-xs font-extrabold uppercase tracking-eyebrow text-muted-foreground">Transparent Pricing</span>
                        <h2 className="mt-2 text-3xl sm:text-5xl">Simple, predictable pricing plans.</h2>
                        <p className="mx-auto mt-3 max-w-2xl text-sm text-foreground/70 sm:text-base">
                            Choose the right subscription for your business scale. No transaction fees ever.
                        </p>
                    </div>

                    <div className={cn("grid items-stretch justify-center gap-gap-lg md:grid-cols-2", "xl:grid-cols-" + plans.length)}>
                        {plans.map((plan, idx) => {
                            return (
                                <PlanCard key={idx} index={idx} plan={plan} />

                           );
                        })}
                    </div>


                </div>
            </section>

            {/* ── BUILD FAST ──────────────────────────────────────────── */}
            <section className="relative overflow-hidden bg-primary px-page text-primary-foreground site-section-spacing">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--on-scrim)_7%,transparent),transparent_55%)]" />

                <div className="site-container relative">
                    <div className="mb-14 max-w-3xl">
                        <span className="text-xs font-extrabold uppercase tracking-eyebrow text-primary-foreground/50">Three steps</span>
                        <h2 className="mt-2 text-3xl tracking-tight sm:text-5xl">Build fast on UnityCommerce</h2>
                        <p className="mt-3 text-sm leading-relaxed text-primary-foreground/60 sm:text-base">
                            From an empty dashboard to your first paid order — without a developer, a designer, or a plugin bill.
                        </p>
                    </div>

                    <div className="grid gap-gap-lg md:grid-cols-3">
                        {launchSteps.map((step, index) => (
                            <motion.div
                                key={step.step}
                                initial={{ opacity: 0, y: 24 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-80px' }}
                                transition={{ delay: index * 0.1 }}
                                className="group relative aspect-3/4 overflow-hidden rounded-2xl border border-primary-foreground/10 bg-primary transition-colors hover:border-primary-foreground/30"
                            >
                                {}
                                <Image
                                    src={step.image}
                                    alt={step.title}
                                    fill
                                    sizes="(min-width: 768px) 33vw, 100vw"
                                    className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                                />

                                {}
                                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,color-mix(in_srgb,var(--scrim)_92%,transparent)_0%,color-mix(in_srgb,var(--scrim)_72%,transparent)_22%,color-mix(in_srgb,var(--scrim)_28%,transparent)_45%,color-mix(in_srgb,var(--scrim)_0%,transparent)_70%)]" />

                                <span className="absolute left-4 top-4 rounded-full bg-scrim/50 px-3 py-1 font-mono text-xs font-bold text-primary-foreground backdrop-blur-sm">
                                    {step.step}
                                </span>

                                <div className="absolute inset-x-0 bottom-0 p-6">
                                    <h3 className="text-lg text-primary-foreground drop-shadow-sm">{step.title}</h3>
                                    <p className="mt-2 text-sm leading-relaxed text-primary-foreground/85">{step.text}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="mt-14 flex flex-col items-center gap-gap rounded-2xl border border-primary-foreground/10 bg-card/[0.03] p-8 text-center sm:flex-row sm:justify-between sm:text-left">
                        <div>
                            <h3 className="text-xl text-primary-foreground sm:text-2xl">Ready to launch your online store?</h3>
                            <p className="mt-1.5 text-sm text-primary-foreground/55">
                                Join modern merchants building high-converting stores with zero platform transaction fees.
                            </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                            <Button asChild size="lg" className="h-13 w-full bg-card px-8 text-base font-semibold text-foreground shadow-lg shadow-scrim/40 hover:bg-card/85 sm:w-auto"><Link href="/register?next=/customer/onboarding&plan=Growth">
                                    Get Started
                                    <ArrowRight className="ml-2 size-4" />
                                </Link></Button>
                            <Button asChild variant="outline" size="lg" className="h-13 w-full border-primary-foreground/20 bg-primary-foreground/5 px-8 text-base font-semibold text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto"><Link href="/#contact">
                                    Talk to Sales
                                </Link></Button>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
};


const PlanCard = ({ plan, index }: { index: number, plan: UnityCommercePlan }) => {
    const price = plan.monthlyPrice
    return (
        <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.08 }}
            className={cn(
                'flex flex-col justify-between rounded-md border p-card transition-all duration-300',
                plan.highlighted
                    ? 'relative z-10 border-foreground bg-primary text-primary-foreground shadow-2xl shadow-foreground/25 xl:-mt-3'
                    : 'border-border bg-card hover:border-input hover:shadow-xl',
            )}
        >
            <div>
                {plan.highlighted && (
                    <span className="mb-4 inline-block rounded-full bg-primary-foreground/20 px-3 py-1 text-micro font-extrabold uppercase tracking-widest text-primary-foreground">
                        Most Popular Choice
                    </span>
                )}
                <h3 className={cn('mb-1 text-2xl font-bold', plan.highlighted ? 'text-primary-foreground' : 'text-foreground')}>{plan.name}</h3>
                <p className={cn('mb-6 text-xs', plan.highlighted ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                    {plan.audience}
                </p>
                <div className={cn('mb-7 border-b pb-6', plan.highlighted ? 'border-primary-foreground/20' : 'border-border')}>
                    {price ? (
                        <>
                            <span className="text-4xl font-extrabold tracking-tight">{price}</span>
                            <span className={cn('ml-1 text-xs font-medium', plan.highlighted ? 'text-primary-foreground/70' : 'text-muted-foreground')}>/month</span>
                        </>
                    ) : (
                        <>
                            <span className="text-3xl font-extrabold tracking-tight">Custom</span>
                            <p className={cn('mt-1 text-xs', plan.highlighted ? 'text-primary-foreground/70' : 'text-muted-foreground')}>Priced to your requirements</p>
                        </>
                    )}
                </div>
                <ul className="mb-8 space-y-3">
                    {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-1 text-xs sm:text-sm">
                            <Check className={cn('mt-0.5 size-4 p-0.5 shrink-0 bg-success rounded-full text-primary-foreground')} />
                            <span className={plan.highlighted ? 'font-medium text-primary-foreground/90' : 'text-foreground/80'}>{feature}</span>
                        </li>
                    ))}
                </ul>
            </div>


            <Button asChild
                    className={cn(
                        'h-12 w-full cursor-pointer text-xs font-bold sm:text-sm',
                        plan.highlighted
                            ? 'bg-card text-foreground shadow-md hover:bg-secondary'
                            : 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90',
                    )}
                ><Link href={price
                ? `/register?next=/customer/onboarding&plan=${encodeURIComponent(plan.name)}`
                : '/#contact'}>
                    {price ? `Start with ${price}` : 'Talk to sales'}
                </Link></Button>
        </motion.div>
    )
}