'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
    ArrowRight,
    Check,
    CheckCircle2,
    CreditCard,
    Headphones,
    ImageIcon,
    LayoutTemplate,
    LockKeyhole,
    Server,
    ShieldCheck,
    Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/utils';

/**
 * A plan as this page draws it.
 *
 * Built by the server component from the Plans table, so the prices here are
 * the prices an admin edits — the page used to carry its own hardcoded list,
 * which had drifted to a different currency and different amounts than the
 * plans the checkout actually sells.
 */
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

/**
 * The three steps in the closing section.
 *
 * The artwork is portrait, so the cards are built around a 3:4 frame rather
 * than the 16:9 the rest of the page uses.
 */
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

/**
 * Stands in for artwork that has not been produced yet.
 *
 * Deliberately looks unfinished rather than decorative: a placeholder that
 * reads as a design choice is one nobody remembers to replace. Swap each usage
 * for an <Image> and delete this when the real screenshots land.
 */
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
                light ? 'border-ink-300 bg-ink-50' : 'border-white/15 bg-white/[0.03]',
                // A faint diagonal hatch, so it cannot be mistaken for a real
                // flat-colour panel at a glance.
                light
                    ? '[background-image:repeating-linear-gradient(45deg,rgba(0,0,0,0.035)_0_10px,transparent_10px_20px)]'
                    : '[background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0.03)_0_10px,transparent_10px_20px)]',
                className,
            )}
        >
            <ImageIcon className={cn('size-6', light ? 'text-ink-300' : 'text-white/25')} />
            <span className={cn(
                'px-4 text-center text-[11px] font-medium uppercase tracking-wider',
                light ? 'text-ink-400' : 'text-white/35',
            )}>
                {label}
            </span>
        </div>
    );
}

export const MainContent = ({ plans }: { plans: UnityCommercePlan[] }) => {
    const [isAnnual, setIsAnnual] = useState(false);

    return (
        <main className="relative bg-white text-ink-950">
            {/* ── HERO ────────────────────────────────────────────────── */}
            <section className="relative isolate overflow-hidden px-4 pb-20 pt-28 sm:pb-28 sm:pt-36">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_15%,rgba(0,0,0,0.07),transparent_45%),radial-gradient(circle_at_15%_85%,rgba(0,0,0,0.04),transparent_40%)]" />
                <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-40 [mask-image:linear-gradient(to_bottom,black_35%,transparent_90%)]" />

                <div className="site-container relative">
                    <div className="flex flex-col items-center text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2 text-xs font-bold tracking-wide text-ink-700 shadow-sm backdrop-blur-md"
                        >
                            <span className="flex size-5 items-center justify-center rounded-full bg-ink-950 text-white">
                                <Sparkles className="size-3" />
                            </span>
                            <span>The Next-Gen Store Builder for Modern Brands</span>
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="mt-6 max-w-4xl text-balance text-4xl font-extrabold leading-[1.05] tracking-[-0.05em] sm:text-6xl lg:text-7xl"
                        >
                            Build the brand you&rsquo;ve{' '}
                            <span className="bg-gradient-to-r from-ink-400 via-ink-950 to-ink-400 bg-clip-text text-transparent">
                                always dreamed of.
                            </span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="mt-6 max-w-2xl text-balance text-base leading-relaxed text-ink-600 sm:text-xl"
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
                            <Button asChild size="lg" className="group h-13 w-full bg-ink-950 px-8 text-base font-semibold text-white shadow-lg shadow-ink-950/20 transition-all hover:bg-ink-800 hover:shadow-xl sm:w-auto"><Link href="/register?next=/customer/onboarding&plan=Growth" className="w-full sm:w-auto">
                                    Start Building Your Store
                                    <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                                </Link></Button>
                            <Button asChild variant="outline" size="lg" className="h-13 w-full border-ink-300 bg-white px-8 text-base font-semibold text-ink-800 shadow-sm hover:bg-ink-50 hover:text-ink-900 sm:w-auto"><Link href="#pricing" className="w-full sm:w-auto">
                                    View Pricing &amp; Plans
                                </Link></Button>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.6, delay: 0.4 }}
                            className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-ink-600 sm:text-sm"
                        >
                            {['0% Transaction Fees', '10 Free Premium Themes', 'Mobile & COD Ready', 'Free SSL & Domain Support'].map((claim) => (
                                <span key={claim} className="flex items-center gap-2">
                                    <CheckCircle2 className="size-4 text-ink-800" />
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
                        className="relative mx-auto mt-14 max-w-6xl"
                    >
                        <div className="absolute -inset-4 rounded-[3.5rem] bg-gradient-to-r from-ink-950/10 via-ink-950/[0.02] to-ink-950/10 blur-3xl" />

                        <div className="relative rounded-xl border border-ink-200 bg-white p-2.5 shadow-[0_32px_90px_rgba(21,21,21,0.14)] sm:p-4 md:rounded-2xl">
                            <div className="mb-3 flex items-center justify-between border-b border-ink-100 px-2 pb-3">
                                <div className="flex items-center gap-2">
                                    <span className="size-3 rounded-full bg-ink-200" />
                                    <span className="size-3 rounded-full bg-ink-200" />
                                    <span className="size-3 rounded-full bg-ink-200" />
                                </div>
                                <div className="flex w-full max-w-sm items-center justify-center gap-2 rounded-md border border-ink-200 bg-ink-50 px-4 py-1.5 text-xs font-medium text-ink-500">
                                    <LockKeyhole className="size-3 text-ink-500" />
                                    <span>https://your-store.com</span>
                                </div>
                                <div className="hidden items-center gap-2 sm:flex">
                                    <span className="rounded-full bg-ink-100 px-2.5 py-1 text-[10px] font-bold text-ink-600">Preview</span>
                                </div>
                            </div>

                            <div className="relative aspect-[16/9.5] overflow-hidden rounded-lg">
                                <ImagePlaceholder label="Storefront mockup — 1600 × 950" tone="light" />

                                {/* Portrait phone, overlapping the desktop frame. */}
                                <div className="absolute -bottom-4 right-4 w-36 overflow-hidden rounded-[1.8rem] border-4 border-ink-950 bg-ink-950 shadow-2xl sm:right-8 sm:w-56 sm:rounded-[2.2rem] sm:border-[6px] md:w-64">
                                    <div className="relative aspect-[9/18.5] w-full">
                                        <ImagePlaceholder label="Mobile" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    <div className="mt-16 grid gap-4 border-t border-ink-200 pt-8 sm:grid-cols-2 lg:grid-cols-4">
                        {commerceHighlights.map((highlight) => (
                            <div key={highlight.title} className="flex items-center gap-3.5 rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
                                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-ink-200 bg-ink-50 text-ink-800">
                                    <highlight.icon className="size-5" />
                                </span>
                                <div>
                                    <p className="text-sm font-bold text-ink-900">{highlight.title}</p>
                                    <p className="mt-0.5 text-xs text-ink-500">{highlight.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── THEMES PREVIEW ──────────────────────────────────────── */}
            <section id="themes" className="scroll-mt-20 bg-ink-950 px-4 text-white site-section-spacing">
                <div className="site-container">
                    <div className="mb-14 max-w-3xl">
                        <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/50">Included with every plan</span>
                        <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-5xl">
                            Featured Free Premium Themes
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-white/60 sm:text-base">
                            Every theme is mobile-responsive and editable in the visual editor — change colours, fonts,
                            banners and sections without touching code. No premium theme fees, ever.
                        </p>
                    </div>

                    {/*
                        A grid rather than a slider: ten portrait cards fit on one
                        screen at three or four across, and a slider would hide
                        most of the range behind an interaction while adding
                        keyboard and screen-reader work for nothing.
                    */}
                    <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
                        {themes.map((theme, index) => (
                            <motion.div
                                key={theme.name}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-80px' }}
                                transition={{ delay: (index % 4) * 0.06 }}
                                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-colors hover:border-white/30"
                            >
                                <div className="relative aspect-[3/4] overflow-hidden">
                                    <ImagePlaceholder label={`${theme.name} preview`} className="border-0" />
                                </div>
                                <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-white">{theme.name}</p>
                                        <p className="truncate text-xs text-white/45">{theme.tag}</p>
                                    </div>
                                    <ArrowRight className="size-4 shrink-0 text-white/25 transition-all group-hover:translate-x-0.5 group-hover:text-white" />
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="mt-10 flex flex-wrap items-center gap-4">
                        {/* <Button asChild size="lg" className="h-12 bg-white px-7 font-bold text-ink-950 hover:bg-white/85"><Link href="/register?next=/customer/onboarding&plan=Growth">
                                Browse all themes
                                <ArrowRight className="ml-2 size-4" />
                            </Link></Button> */}
                        <p className="text-xs text-white/45">Switch themes at any time — your products and orders stay put.</p>
                    </div>
                </div>
            </section>

            {/* ── PRICING (structure unchanged; recoloured for the dark page) ── */}
            <section id="pricing" className="scroll-mt-20 border-t border-ink-100 site-section-spacing">
                <div className="site-container px-4">
                    <div className="mb-12 text-center">
                        <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-500">Transparent Pricing</span>
                        <h2 className="mt-2 text-3xl font-extrabold sm:text-5xl">Simple, predictable pricing plans.</h2>
                        <p className="mx-auto mt-3 max-w-2xl text-sm text-ink-600 sm:text-base">
                            Choose the right subscription for your business scale. No transaction fees ever.
                        </p>

                        {/* <div className="mt-8 flex items-center justify-center gap-3">
                            <span className={cn('text-xs font-bold sm:text-sm', !isAnnual ? 'text-ink-950' : 'text-ink-500')}>
                                Monthly Billing
                            </span>
                            <Switch
                                checked={isAnnual}
                                onCheckedChange={setIsAnnual}
                                aria-label={isAnnual ? 'Switch to monthly billing' : 'Switch to annual billing'}
                            />
                            <span className={cn('flex items-center gap-1.5 text-xs font-bold sm:text-sm', isAnnual ? 'text-ink-950' : 'text-ink-500')}>
                                Annual Billing
                                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-ink-600">Save ~20%</span>
                            </span>
                        </div> */}
                    </div>

                    <div className={cn("grid items-stretch justify-center gap-6 md:grid-cols-2", "xl:grid-cols-" + plans.length)}>
                        {plans.map((plan, idx) => {
                            return (
                                <PlanCard key={idx} index={idx} plan={plan} />

                           );
                        })}
                    </div>


                </div>
            </section>

            {/* ── BUILD FAST ──────────────────────────────────────────── */}
            <section className="relative overflow-hidden bg-ink-950 px-4 text-white site-section-spacing">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.07),transparent_55%)]" />

                <div className="site-container relative">
                    <div className="mb-14 max-w-3xl">
                        <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/50">Three steps</span>
                        <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-5xl">Build fast on UnityCommerce</h2>
                        <p className="mt-3 text-sm leading-relaxed text-white/60 sm:text-base">
                            From an empty dashboard to your first paid order — without a developer, a designer, or a plugin bill.
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-3">
                        {launchSteps.map((step, index) => (
                            <motion.div
                                key={step.step}
                                initial={{ opacity: 0, y: 24 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-80px' }}
                                transition={{ delay: index * 0.1 }}
                                className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 bg-ink-900 transition-colors hover:border-white/30"
                            >
                                {/* Portrait artwork: a 3:4 frame, so nothing is cropped
                                    to a letterbox the source images were never shot for. */}
                                <Image
                                    src={step.image}
                                    alt={step.title}
                                    fill
                                    sizes="(min-width: 768px) 33vw, 100vw"
                                    className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                                />

                                {/*
                                    The caption sits on the photograph, so the image has
                                    to carry it. Four stops rather than a plain
                                    from-black/70: a linear fade leaves the middle of the
                                    text band too light over a bright photo, and going
                                    dark enough to fix that turns the bottom third into a
                                    black bar. This holds ~0.9 behind the text, releases
                                    quickly, and is gone by 70% so most of the picture is
                                    untouched.
                                */}
                                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.72)_22%,rgba(0,0,0,0.28)_45%,rgba(0,0,0,0)_70%)]" />

                                <span className="absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1 font-mono text-xs font-bold text-white backdrop-blur-sm">
                                    {step.step}
                                </span>

                                <div className="absolute inset-x-0 bottom-0 p-6">
                                    <h3 className="text-lg font-bold text-white drop-shadow-sm">{step.title}</h3>
                                    <p className="mt-2 text-sm leading-relaxed text-white/85">{step.text}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="mt-14 flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center sm:flex-row sm:justify-between sm:text-left">
                        <div>
                            <h3 className="text-xl font-bold text-white sm:text-2xl">Ready to launch your online store?</h3>
                            <p className="mt-1.5 text-sm text-white/55">
                                Join modern merchants building high-converting stores with zero platform transaction fees.
                            </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                            <Button asChild size="lg" className="h-13 w-full bg-white px-8 text-base font-semibold text-ink-950 shadow-lg shadow-black/40 hover:bg-white/85 sm:w-auto"><Link href="/register?next=/customer/onboarding&plan=Growth">
                                    Get Started
                                    <ArrowRight className="ml-2 size-4" />
                                </Link></Button>
                            <Button asChild variant="outline" size="lg" className="h-13 w-full border-white/20 bg-white/5 px-8 text-base font-semibold text-white hover:bg-white/10 hover:text-white sm:w-auto"><Link href="/#contact">
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
                'flex flex-col justify-between rounded-md border p-6 transition-all duration-300',
                plan.highlighted
                    ? 'relative z-10 border-ink-950 bg-ink-950 text-white shadow-2xl shadow-ink-950/25 xl:-mt-3'
                    : 'border-ink-200 bg-white hover:border-ink-400 hover:shadow-xl',
            )}
        >
            <div>
                {plan.highlighted && (
                    <span className="mb-4 inline-block rounded-full bg-white/20 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white">
                        Most Popular Choice
                    </span>
                )}
                <h3 className={cn('mb-1 text-2xl font-bold', plan.highlighted ? 'text-white' : 'text-ink-950')}>{plan.name}</h3>
                <p className={cn('mb-6 text-xs', plan.highlighted ? 'text-white/80' : 'text-ink-500')}>
                    {plan.audience}
                </p>
                <div className={cn('mb-7 border-b pb-6', plan.highlighted ? 'border-white/20' : 'border-ink-200')}>
                    {price ? (
                        <>
                            <span className="text-4xl font-extrabold tracking-tight">{price}</span>
                            <span className={cn('ml-1 text-xs font-medium', plan.highlighted ? 'text-white/70' : 'text-ink-500')}>/month</span>
                        </>
                    ) : (
                        <>
                            <span className="text-3xl font-extrabold tracking-tight">Custom</span>
                            <p className={cn('mt-1 text-xs', plan.highlighted ? 'text-white/70' : 'text-ink-500')}>Priced to your requirements</p>
                        </>
                    )}
                </div>
                <ul className="mb-8 space-y-3">
                    {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-1 text-xs sm:text-sm">
                            <Check className={cn('mt-0.5 size-4 p-0.5 shrink-0 bg-success-500 rounded-full text-white')} />
                            <span className={plan.highlighted ? 'font-medium text-white/90' : 'text-ink-700'}>{feature}</span>
                        </li>
                    ))}
                </ul>
            </div>


            <Button asChild
                    className={cn(
                        'h-12 w-full cursor-pointer text-xs font-bold sm:text-sm',
                        plan.highlighted
                            ? 'bg-white text-ink-950 shadow-md hover:bg-ink-100'
                            : 'bg-ink-950 text-white shadow-md hover:bg-ink-800',
                    )}
                ><Link href={price
                ? `/register?next=/customer/onboarding&plan=${encodeURIComponent(plan.name)}`
                : '/#contact'}>
                    {price ? `Start with ${price}` : 'Talk to sales'}
                </Link></Button>
        </motion.div>
    )
}