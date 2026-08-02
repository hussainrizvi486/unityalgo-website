'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    Rocket, ArrowRight, ArrowUpRight, ShieldCheck, Zap, Layers, BrainCircuit,
    CheckCircle2, Check, Info, AlertTriangle, XCircle, Facebook, Linkedin,
    ChevronDown, Search, Upload, Link as LinkIcon, Table as TableIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
    Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Logo } from '@/components/Logo';
import { Footer } from '@/components/layouts/footer';
import { FaqSection } from '@/components/website/faq-section';
import { PricingTable } from '@/components/website/pricing-table';
import { ProjectFlow } from '@/components/website/project-flow';
import { FeaturesGrid } from '@/components/website/features-grid';
import { AdminPagination } from '@/components/admin/pagination';
import { cn } from '@/utils';

const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'branding', label: 'Logo & Branding' },
    { id: 'colors', label: 'Color Palette' },
    { id: 'typography', label: 'Typography' },
    { id: 'buttons', label: 'Buttons' },
    { id: 'forms', label: 'Form Elements' },
    { id: 'badges', label: 'Badges & Tags' },
    { id: 'alerts', label: 'Alerts' },
    { id: 'cards', label: 'Cards' },
    { id: 'tables', label: 'Tables & Pagination' },
    { id: 'navigation', label: 'Navigation' },
    { id: 'accordion', label: 'Accordion' },
    { id: 'overlays', label: 'Modals & Popovers' },
    { id: 'borders', label: 'Borders & Radius' },
    { id: 'shadows', label: 'Shadows' },
    { id: 'spacing', label: 'Spacing Scale' },
    { id: 'backgrounds', label: 'Backgrounds & Gradients' },
    { id: 'icons', label: 'Icons' },
    { id: 'components', label: 'Composed Components' },
    { id: 'footer', label: 'Footer' },
];

function SectionHeading({ id, title, description }: { id: string; title: string; description?: string }) {
    return (
        <div id={id} className="scroll-mt-24 mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-ink-900">{title}</h2>
            {description && <p className="text-ink-500 mt-2 max-w-2xl">{description}</p>}
        </div>
    );
}

function Swatch({
    name,
    className,
    value,
    textClassName = 'text-white',
}: {
    name: string;
    className: string;
    value?: string;
    textClassName?: string;
}) {
    return (
        <div className="flex flex-col rounded-xl overflow-hidden border border-ink-100">
            <div className={cn('h-20 flex items-end p-2', className)}>
                <span className={cn('text-xs font-mono', textClassName)}>{value}</span>
            </div>
            <div className="px-3 py-2 bg-white">
                <p className="text-xs font-semibold text-ink-800">{name}</p>
            </div>
        </div>
    );
}

function CodeLabel({ children }: { children: React.ReactNode }) {
    return <code className="text-xs bg-ink-100 text-ink-600 rounded px-1.5 py-0.5 font-mono">{children}</code>;
}

const faqItems = [
    { question: 'What is a design system for?', answer: 'It keeps color, type, spacing, and components consistent across every page so the site feels like one product instead of a patchwork of pages.' },
    { question: 'Where do these tokens live?', answer: 'Brand colors and fonts are defined once in app/globals.css under @theme, then referenced everywhere via Tailwind utility classes.' },
    { question: 'Can I extend this page?', answer: 'Yes — this route is a plain Next.js page. Add a new section as new components ship so this stays the single source of truth.' },
];

const pricingPlans = [
    { name: 'Basic', price: '10.00', priceSuffix: '/mo', users: '5', features: ['Core features', 'Email support'] },
    { name: 'Premium', price: '50.00', priceSuffix: '/mo', users: '25', highlighted: true, features: ['Everything in Basic', 'Priority support', 'Advanced reporting'] },
    { name: 'Enterprise', price: 'Contact', users: 'Contact', features: ['Custom SLAs', 'Dedicated support'] },
];

const flowStages = [
    { number: '01', title: 'Discover', description: 'Align on scope, priorities, and budget before writing a line of code.' },
    { number: '02', title: 'Design', description: 'Wireframes and UI screens that define the look and feel.' },
    { number: '03', title: 'Build', description: 'Agile sprints ship an MVP, then iterate with real feedback.' },
    { number: '04', title: 'Support', description: 'Ongoing maintenance and new functionality after launch.' },
];

export default function ThemePreviewPage() {
    const [dialogOpen, setDialogOpen] = useState(false);

    return (
        <div className="bg-background text-foreground min-h-screen">
            {/* --- PAGE HEADER --- */}
            <div className="border-b border-ink-100 bg-white/80 backdrop-blur-md sticky top-0 z-40">
                <div className="container mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Logo className="h-9" />
                        <span className="text-sm font-semibold text-ink-400 hidden sm:inline">/ Theme Preview</span>
                    </div>
                    <Link href="/" className="text-sm font-medium text-brand hover:opacity-75 flex items-center gap-1">
                        Back to site <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </div>

            <div className="container mx-auto px-4 md:px-6 py-10 flex gap-10">
                {/* --- STICKY TOC --- */}
                <nav className="hidden lg:block w-56 shrink-0">
                    <div className="sticky top-24 space-y-1">
                        <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-3 px-3">On this page</p>
                        {sections.map((s) => (
                            <a
                                key={s.id}
                                href={`#${s.id}`}
                                className="block px-3 py-1.5 text-sm text-ink-600 hover:opacity-75 hover:bg-accent rounded-lg transition-colors"
                            >
                                {s.label}
                            </a>
                        ))}
                    </div>
                </nav>

                {/* --- CONTENT --- */}
                <div className="flex-1 min-w-0 space-y-24">
                    {/* OVERVIEW */}
                    <section id="overview" className="scroll-mt-24">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent border border-brand/15 mb-6">
                            <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                            <span className="text-xs font-semibold text-brand tracking-wide uppercase">Design System</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-ink-900 mb-4 text-balance">
                            UnityAlgo Theme Preview
                        </h1>
                        <p className="text-lg text-ink-600 max-w-2xl leading-relaxed">
                            Every color, type style, and component used across the site, in one place — a living reference
                            for reviewing consistency and branding as the product grows.
                        </p>
                    </section>

                    {/* LOGO & BRANDING */}
                    <section>
                        <SectionHeading id="branding" title="Logo & Branding" description="components/Logo.tsx — Poppins wordmark + SVG mark, two size presets used across the site." />
                        <div className="grid sm:grid-cols-2 gap-6">
                            <div className="flex flex-col items-start gap-4 p-8 rounded-2xl border border-ink-100 bg-white">
                                <Logo className="h-12" />
                                <CodeLabel>{'<Logo className="h-12" />'}</CodeLabel>
                                <span className="text-xs text-ink-400">Used in Header</span>
                            </div>
                            <div className="flex flex-col items-start gap-4 p-8 rounded-2xl bg-ink-950">
                                <Logo className="h-10" />
                                <CodeLabel>{'<Logo className="h-10" />'}</CodeLabel>
                                <span className="text-xs text-ink-300">Used in Footer, on dark background</span>
                            </div>
                        </div>
                    </section>

                    {/* COLORS */}
                    <section>
                        <SectionHeading id="colors" title="Color Palette" description="Full-light, minimal palette: crimson primary — the logo mark's own color (hue 358°, #8C181B) — true-grayscale neutrals, and white throughout. No secondary accent hue. All defined once in app/globals.css under @theme." />

                        <h3 className="text-sm font-semibold text-ink-500 uppercase tracking-wide mb-3">Brand — one color, the logo mark's own red. No scale: hover/active use brightness/opacity utilities, tints use opacity or the accent pair below</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
                            <Swatch name="brand" className="bg-brand" value="#8C181B" />
                            <Swatch name="brand hover:brightness-90" className="bg-brand brightness-90" />
                            <Swatch name="brand/20 (tints, rings, shadows)" className="bg-brand/20" textClassName="text-ink-900" />
                            <Swatch name="brand/10" className="bg-brand/10" textClassName="text-ink-900" />
                        </div>

                        <h3 className="text-sm font-semibold text-ink-500 uppercase tracking-wide mb-3">Ink (Neutral) — true grayscale for body text, borders, muted surfaces</h3>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-10">
                            <Swatch name="ink-50" className="bg-ink-50" textClassName="text-ink-900" />
                            <Swatch name="ink-100" className="bg-ink-100" textClassName="text-ink-900" />
                            <Swatch name="ink-200" className="bg-ink-200" textClassName="text-ink-900" />
                            <Swatch name="ink-300" className="bg-ink-300" textClassName="text-ink-900" />
                            <Swatch name="ink-400" className="bg-ink-400" />
                            <Swatch name="ink-500" className="bg-ink-500" />
                            <Swatch name="ink-600" className="bg-ink-600" />
                            <Swatch name="ink-700" className="bg-ink-700" />
                            <Swatch name="ink-800" className="bg-ink-800" />
                            <Swatch name="ink-900" className="bg-ink-900" />
                            <Swatch name="ink-950" className="bg-ink-950" />
                        </div>

                        <h3 className="text-sm font-semibold text-ink-500 uppercase tracking-wide mb-3">The logo against the palette — mark and primary now share one hue</h3>
                        <div className="grid sm:grid-cols-2 gap-4 mb-10">
                            <div className="flex items-center gap-4 p-6 rounded-2xl border border-ink-100 bg-white">
                                <Logo className="h-10" />
                                <span className="text-xs text-ink-400">on light</span>
                            </div>
                            <div className="flex items-center gap-4 p-6 rounded-2xl bg-ink-950">
                                <Logo className="h-10" />
                                <span className="text-xs text-white/50">on ink-950 (footer)</span>
                            </div>
                        </div>

                        <h3 className="text-sm font-semibold text-ink-500 uppercase tracking-wide mb-3">Base Tokens — now wired to the palette above (previously several were undefined/broken)</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
                            <Swatch name="background" className="bg-background border" textClassName="text-ink-500" />
                            <Swatch name="foreground" className="bg-foreground" />
                            <Swatch name="primary → brand" className="bg-primary" />
                            <Swatch name="secondary → ink-100" className="bg-secondary" textClassName="text-ink-900" />
                            <Swatch name="accent → color-mix(brand 8%, white)" className="bg-accent" textClassName="text-ink-900" />
                            <Swatch name="destructive → error-600" className="bg-destructive" />
                            <Swatch name="muted → ink-50" className="bg-muted" textClassName="text-ink-900" />
                            <Swatch name="input → ink-200" className="bg-input" textClassName="text-ink-900" />
                        </div>

                        <h3 className="text-sm font-semibold text-ink-500 uppercase tracking-wide mb-3">Neutral Scale (Tailwind gray) — used for body text, borders, muted backgrounds</h3>
                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-10">
                            {[
                                { n: 50, cls: 'bg-ink-50' },
                                { n: 100, cls: 'bg-ink-100' },
                                { n: 200, cls: 'bg-ink-200' },
                                { n: 300, cls: 'bg-ink-300' },
                                { n: 400, cls: 'bg-ink-400' },
                                { n: 500, cls: 'bg-ink-500' },
                                { n: 600, cls: 'bg-ink-600' },
                                { n: 700, cls: 'bg-ink-700' },
                                { n: 800, cls: 'bg-ink-800' },
                                { n: 900, cls: 'bg-ink-900' },
                            ].map(({ n, cls }) => (
                                <div key={n} className="flex flex-col items-center gap-1.5">
                                    <div className={cn('w-full h-14 rounded-lg', cls)} />
                                    <span className="text-[11px] text-ink-500 font-mono">{n}</span>
                                </div>
                            ))}
                        </div>

                        <h3 className="text-sm font-semibold text-ink-500 uppercase tracking-wide mb-3">Status Colors — success / warning / error / info</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <Swatch name="success-600" className="bg-success-600" value="Published badges, confirmations" />
                            <Swatch name="warning-600" className="bg-warning-600" value="Caution states" />
                            <Swatch name="error-600" className="bg-error-600" value="Delete, destructive, validation" />
                            <Swatch name="info-600" className="bg-info-600" value="Informational callouts" />
                        </div>
                    </section>

                    {/* TYPOGRAPHY */}
                    <section>
                        <SectionHeading id="typography" title="Typography" description="Inter everywhere (body{} and h1,h2,h3{} both reference next/font's real --font-inter variable directly). The wordmark alone pins Poppins via the .font-logo utility." />
                        <div className="space-y-5 p-8 rounded-2xl border border-ink-100 bg-white">
                            <div>
                                <h1 className="text-5xl font-bold tracking-tight text-ink-900">Heading 1 / text-5xl</h1>
                                <CodeLabel>font-bold · text-5xl</CodeLabel>
                            </div>
                            <div>
                                <h2 className="text-4xl font-bold text-ink-900">Heading 2 / text-4xl</h2>
                                <CodeLabel>font-bold · text-4xl</CodeLabel>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-ink-900">Heading 3 / text-2xl</h3>
                                <CodeLabel>font-bold · text-2xl</CodeLabel>
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-ink-900">Heading 4 / text-lg</h4>
                                <CodeLabel>font-bold · text-lg</CodeLabel>
                            </div>
                            <div>
                                <p className="text-xl text-ink-600 leading-relaxed">
                                    Lead paragraph / text-xl — used under hero headings to set up the value proposition.
                                </p>
                            </div>
                            <div>
                                <p className="text-base text-ink-600 leading-relaxed">
                                    Body text / text-base — the default reading size for paragraphs across marketing pages.
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-ink-500">Small / text-sm — captions, meta info, helper text.</p>
                            </div>
                            <div>
                                <p className="text-xs text-ink-400 uppercase tracking-widest font-semibold">Eyebrow / text-xs uppercase tracking-widest</p>
                            </div>
                            <div className="flex flex-wrap gap-4 pt-2 border-t border-ink-100">
                                <span className="font-light">Light 300</span>
                                <span className="font-normal">Regular 400</span>
                                <span className="font-medium">Medium 500</span>
                                <span className="font-semibold">Semibold 600</span>
                                <span className="font-bold">Bold 700</span>
                            </div>
                            <div>
                                <Link href="#" className="text-brand hover:underline font-semibold">Link text example →</Link>
                            </div>
                        </div>
                    </section>

                    {/* BUTTONS */}
                    <section>
                        <SectionHeading id="buttons" title="Buttons" description="components/ui/button.tsx — variant × size matrix, plus real button treatments used on marketing pages." />

                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm mb-8">
                                <thead>
                                    <tr className="text-left text-ink-400 text-xs uppercase tracking-wide">
                                        <th className="py-2 pr-4">Variant</th>
                                        <th className="py-2 pr-4">sm</th>
                                        <th className="py-2 pr-4">default</th>
                                        <th className="py-2 pr-4">lg</th>
                                        <th className="py-2 pr-4">icon</th>
                                        <th className="py-2 pr-4">disabled</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const).map((variant) => (
                                        <tr key={variant} className="border-t border-ink-100">
                                            <td className="py-3 pr-4 font-mono text-xs text-ink-500">{variant}</td>
                                            <td className="py-3 pr-4"><Button variant={variant} size="sm">Button</Button></td>
                                            <td className="py-3 pr-4"><Button variant={variant}>Button</Button></td>
                                            <td className="py-3 pr-4"><Button variant={variant} size="lg">Button</Button></td>
                                            <td className="py-3 pr-4"><Button variant={variant} size="icon"><ArrowRight className="w-4 h-4" /></Button></td>
                                            <td className="py-3 pr-4"><Button variant={variant} disabled>Button</Button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <h3 className="text-sm font-semibold text-ink-500 uppercase tracking-wide mb-3">Real treatments used on marketing pages</h3>
                        <div className="flex flex-wrap gap-4">
                            <Button size="lg" className="rounded-full bg-brand hover:brightness-90 text-white shadow-lg shadow-brand/25 hover:scale-105 transition-all">
                                Get Started <ArrowRight className="ml-1 size-4" />
                            </Button>
                            <Button variant="outline" size="lg" className="rounded-full bg-white/60 backdrop-blur-md shadow-md border-input hover:bg-white">
                                Our Services
                            </Button>
                            <Button className="rounded-full bg-white text-ink-900 hover:bg-ink-100">CTA on dark background</Button>
                            <Button variant="ghost" className="rounded-md hover:bg-ink-100 text-ink-600">
                                Learn more <ArrowUpRight className="ml-1 w-4 h-4" />
                            </Button>
                        </div>
                    </section>

                    {/* FORMS */}
                    <section>
                        <SectionHeading id="forms" title="Form Elements" description="Inputs, checkbox, native + Radix selects, textarea, and the admin panel's color/upload field patterns." />

                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1.5">Text input</label>
                                    <Input placeholder="you@example.com" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1.5">Disabled input</label>
                                    <Input placeholder="Disabled" disabled />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1.5">Invalid input</label>
                                    <Input placeholder="Invalid value" aria-invalid />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1.5">Textarea</label>
                                    <textarea
                                        rows={3}
                                        placeholder="Tell us about your project…"
                                        className="w-full rounded-md border border-input px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Checkbox id="preview-checkbox" defaultChecked />
                                    <label htmlFor="preview-checkbox" className="text-sm text-ink-700">Checkbox — checked state</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Checkbox id="preview-checkbox-2" />
                                    <label htmlFor="preview-checkbox-2" className="text-sm text-ink-700">Checkbox — unchecked</label>
                                </div>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1.5">Native select (admin filters)</label>
                                    <select className="h-9 w-full rounded-md border border-input px-3 text-sm bg-white">
                                        <option>All</option>
                                        <option>Published</option>
                                        <option>Draft</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1.5">Radix select</label>
                                    <Select defaultValue="basic">
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose a plan" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="basic">Basic</SelectItem>
                                            <SelectItem value="premium">Premium</SelectItem>
                                            <SelectItem value="enterprise">Enterprise</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1.5">Color field pattern (admin)</label>
                                    <div className="flex items-center gap-2">
                                        <div className="w-9 h-9 rounded-md border border-input" style={{ backgroundColor: '#B31B1B' }} />
                                        <Input value="#B31B1B" readOnly className="font-mono" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1.5">Upload field pattern (admin)</label>
                                    <Button type="button" variant="outline" className="rounded-full">
                                        <Upload className="w-3.5 h-3.5" /> Choose File
                                    </Button>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1.5">Search input (admin filters)</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                                        <Input placeholder="Search…" className="pl-9" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* BADGES */}
                    <section>
                        <SectionHeading id="badges" title="Badges & Tags" description="Status pills, tag chips, and eyebrow badges used across blog, admin, and marketing pages." />
                        <div className="flex flex-wrap gap-3 items-center">
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-success-50 text-success-600">Published</span>
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-ink-100 text-ink-500">Draft</span>
                            <span className="text-xs font-semibold text-brand bg-accent border border-brand/15 rounded-full px-3 py-1 uppercase tracking-wide">Blog Tag</span>
                            <span className="px-2.5 py-1 text-xs font-medium bg-ink-100 rounded-full border border-ink-200">Tech Chip</span>
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent border border-brand/15">
                                <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                                <span className="text-xs font-semibold text-brand tracking-wide uppercase">Eyebrow Badge</span>
                            </span>
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-error-50 text-error-700">Error</span>
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-warning-50 text-warning-700">Warning</span>
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-info-50 text-info-600">Info</span>
                        </div>
                    </section>

                    {/* ALERTS */}
                    <section>
                        <SectionHeading id="alerts" title="Alerts" description="Inline feedback states used in admin forms." />
                        <div className="space-y-3">
                            <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-error-50 text-error-700 text-sm">
                                <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                <span>Cannot delete the last remaining admin user.</span>
                            </div>
                            <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-success-50 text-success-600 text-sm">
                                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                                <span>Password updated.</span>
                            </div>
                            <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-warning-50 text-warning-700 text-sm">
                                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                <span>Colors must be valid hex values, e.g. #ffffff.</span>
                            </div>
                            <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-info-50 text-info-600 text-sm">
                                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                                <span>Optional — leave blank to use the site default.</span>
                            </div>
                        </div>
                    </section>

                    {/* CARDS */}
                    <section>
                        <SectionHeading id="cards" title="Cards" description="The four recurring card treatments found across the site." />
                        <div className="grid sm:grid-cols-2 gap-6">
                            <div className="p-8 rounded-3xl border border-ink-100 hover:border-brand/25 hover:shadow-xl hover:shadow-ink-900/5 transition-all duration-300">
                                <h3 className="text-lg font-bold text-ink-900 mb-2">Bordered Card</h3>
                                <p className="text-sm text-ink-600">rounded-3xl · border-ink-100 · hover:shadow-ink-900/5</p>
                            </div>
                            <div className="p-8 rounded-3xl bg-white/60 backdrop-blur-md border border-white/60 hover:bg-white hover:border-brand/15 hover:shadow-2xl hover:shadow-ink-900/5 transition-all duration-300">
                                <h3 className="text-lg font-bold text-ink-900 mb-2">Glass Card</h3>
                                <p className="text-sm text-ink-600">bg-white/60 · backdrop-blur-md · border-white/60</p>
                            </div>
                            <div className="p-8 rounded-md bg-white shadow-sm hover:shadow-xl transition-all duration-300">
                                <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mb-6">
                                    <Zap className="w-7 h-7 text-brand" />
                                </div>
                                <h3 className="text-lg font-bold text-ink-900 mb-2">Feature Card</h3>
                                <p className="text-sm text-ink-600">rounded-md · shadow-sm → shadow-xl on hover</p>
                            </div>
                            <div className="p-8 rounded-3xl bg-gradient-to-br from-ink-950 to-black text-white">
                                <h3 className="text-lg font-bold mb-2">Dark CTA Card</h3>
                                <p className="text-sm text-white/70">bg-gradient-to-br from-ink-950 to-black</p>
                            </div>
                        </div>
                    </section>

                    {/* TABLES */}
                    <section>
                        <SectionHeading id="tables" title="Tables & Pagination" description="The admin list-view table pattern, plus the shared pagination component (page size: 50)." />
                        <div className="bg-white border border-ink-100 rounded-2xl overflow-hidden mb-6">
                            <table className="w-full text-sm">
                                <thead className="bg-ink-50 text-left text-ink-500 uppercase text-xs tracking-wide">
                                    <tr>
                                        <th className="px-6 py-4">Title</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Updated</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ink-100">
                                    {[
                                        { title: 'Finance Transformation', status: 'Published' },
                                        { title: 'Choosing a Modern POS', status: 'Draft' },
                                    ].map((row) => (
                                        <tr key={row.title}>
                                            <td className="px-6 py-4 font-medium text-ink-900">{row.title}</td>
                                            <td className="px-6 py-4">
                                                <span className={cn(
                                                    'text-xs font-semibold px-2.5 py-1 rounded-full',
                                                    row.status === 'Published' ? 'bg-success-50 text-success-600' : 'bg-ink-100 text-ink-500'
                                                )}>
                                                    {row.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-ink-500">Jul 22, 2026</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button size="sm" variant="outline" className="rounded-full">Edit</Button>
                                                    <Button size="sm" variant="destructive" className="rounded-full">Delete</Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <AdminPagination basePath="#tables" currentPage={3} totalPages={7} />
                    </section>

                    {/* NAVIGATION */}
                    <section>
                        <SectionHeading id="navigation" title="Navigation" description="Header nav pill (site) and sidebar pattern (admin) — recreated here since the live Header is fixed-position." />
                        <div className="p-6 rounded-2xl border border-ink-100 bg-ink-50 mb-6">
                            <nav className="inline-flex items-center gap-1 bg-white/80 backdrop-blur-md px-2 py-1.5 rounded-full border border-white/20 shadow-sm">
                                {['Home', 'Services', 'About Us', 'Blog', 'Contact'].map((item, i) => (
                                    <button
                                        key={item}
                                        className={cn(
                                            'relative px-5 py-2 text-sm font-medium rounded-full transition-colors',
                                            i === 0 ? 'bg-ink-200/50 text-ink-900' : 'text-ink-600 hover:bg-ink-100'
                                        )}
                                    >
                                        {item}
                                    </button>
                                ))}
                            </nav>
                        </div>
                        <div className="flex gap-0 rounded-2xl border border-ink-100 overflow-hidden max-w-xs">
                            <aside className="w-full bg-white">
                                <div className="px-4 py-3 border-b border-ink-100 font-bold text-sm">Admin</div>
                                <nav className="p-2 space-y-1">
                                    {['Blogs', 'Users', 'Contacts'].map((item, i) => (
                                        <div
                                            key={item}
                                            className={cn(
                                                'px-3 py-2 rounded-lg text-sm font-medium',
                                                i === 0 ? 'bg-accent text-brand' : 'text-ink-600'
                                            )}
                                        >
                                            {item}
                                        </div>
                                    ))}
                                </nav>
                            </aside>
                        </div>
                    </section>

                    {/* ACCORDION */}
                    <section>
                        <SectionHeading id="accordion" title="Accordion" description="components/ui/accordion.tsx — used for FAQs and the module-page overview sidebar." />
                        <div className="max-w-2xl bg-white rounded-2xl border border-ink-100 px-4">
                            <Accordion type="single" collapsible defaultValue="item-0">
                                {faqItems.map((item, idx) => (
                                    <AccordionItem key={idx} value={`item-${idx}`}>
                                        <AccordionTrigger className="text-base text-ink-900">{item.question}</AccordionTrigger>
                                        <AccordionContent className="text-ink-600 leading-relaxed">{item.answer}</AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </div>
                    </section>

                    {/* OVERLAYS */}
                    <section>
                        <SectionHeading id="overlays" title="Modals & Popovers" description="Radix Dialog and Popover primitives, styled to match the site." />
                        <div className="flex flex-wrap gap-4">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="rounded-full">Open Popover</Button>
                                </PopoverTrigger>
                                <PopoverContent>
                                    <p className="text-sm text-ink-600 px-2 py-1">Popover content — bg-popover, shadow-md, border-ink-200.</p>
                                </PopoverContent>
                            </Popover>

                            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="rounded-full bg-brand hover:brightness-90 text-white">Open Dialog</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Confirm action</DialogTitle>
                                        <DialogDescription>This is the Dialog primitive used for confirmations across the admin panel.</DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button variant="outline" className="rounded-full">Cancel</Button>
                                        </DialogClose>
                                        <Button className="rounded-full bg-brand hover:brightness-90 text-white">Confirm</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </section>

                    {/* BORDERS & RADIUS */}
                    <section>
                        <SectionHeading id="borders" title="Borders & Radius" description="The radius scale used throughout — from tight admin controls to fully-rounded pills." />
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                            {[
                                { label: 'rounded-md', cls: 'rounded-md' },
                                { label: 'rounded-lg', cls: 'rounded-lg' },
                                { label: 'rounded-xl', cls: 'rounded-xl' },
                                { label: 'rounded-2xl', cls: 'rounded-2xl' },
                                { label: 'rounded-3xl', cls: 'rounded-3xl' },
                                { label: 'rounded-full', cls: 'rounded-full' },
                            ].map((r) => (
                                <div key={r.label} className="flex flex-col items-center gap-2">
                                    <div className={cn('w-16 h-16 bg-accent border-2 border-brand', r.cls)} />
                                    <span className="text-xs font-mono text-ink-500">{r.label}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* SHADOWS */}
                    <section>
                        <SectionHeading id="shadows" title="Shadows" description="Standard elevation scale plus the tinted brand shadows used on buttons and CTAs." />
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
                            {[
                                { label: 'shadow-sm', cls: 'shadow-sm' },
                                { label: 'shadow-md', cls: 'shadow-md' },
                                { label: 'shadow-lg', cls: 'shadow-lg' },
                                { label: 'shadow-xl', cls: 'shadow-xl' },
                                { label: 'shadow-2xl', cls: 'shadow-2xl' },
                            ].map((s) => (
                                <div key={s.label} className="flex flex-col items-center gap-2">
                                    <div className={cn('w-16 h-16 bg-white rounded-xl', s.cls)} />
                                    <span className="text-xs font-mono text-ink-500">{s.label}</span>
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-6 mt-6 max-w-md">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-16 h-16 bg-brand rounded-xl shadow-lg shadow-brand/25" />
                                <span className="text-xs font-mono text-ink-500">shadow-brand/25</span>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-16 h-16 bg-white rounded-xl shadow-xl shadow-ink-900/5" />
                                <span className="text-xs font-mono text-ink-500">shadow-ink-900/5</span>
                            </div>
                        </div>
                    </section>

                    {/* SPACING */}
                    <section>
                        <SectionHeading id="spacing" title="Spacing Scale" description="Common gap/padding values used for card and section rhythm." />
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24].map((n) => (
                                <div key={n} className="flex items-center gap-4">
                                    <span className="text-xs font-mono text-ink-400 w-10 text-right">{n}</span>
                                    <div className="h-3 bg-brand rounded" style={{ width: `${n * 4}px` }} />
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* BACKGROUNDS */}
                    <section>
                        <SectionHeading id="backgrounds" title="Backgrounds & Gradients" description="Decorative surfaces layered behind hero and CTA sections." />
                        <div className="grid sm:grid-cols-2 gap-6">
                            <div className="relative h-32 rounded-2xl overflow-hidden border border-ink-100">
                                <div className="absolute inset-0 bg-grid-pattern mask-[radial-gradient(ellipse_at_center,black_30%,transparent_70%)] opacity-40" />
                                <span className="absolute bottom-3 left-3 text-xs font-mono text-ink-500">.bg-grid-pattern</span>
                            </div>
                            <div className="relative h-32 rounded-2xl overflow-hidden glass border border-white/20">
                                <span className="absolute bottom-3 left-3 text-xs font-mono text-ink-500">.glass</span>
                            </div>
                            <div className="relative h-32 rounded-2xl overflow-hidden bg-gradient-to-br from-ink-950 to-black">
                                <span className="absolute bottom-3 left-3 text-xs font-mono text-white/60">from-ink-950 to-black</span>
                            </div>
                            <div className="relative h-32 rounded-2xl overflow-hidden bg-brand">
                                <span className="absolute bottom-3 left-3 text-xs font-mono text-white/80">bg-brand (solid, no scale)</span>
                            </div>
                            <div className="relative h-32 rounded-2xl overflow-hidden bg-ink-900">
                                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/70 to-black/40" />
                                <span className="absolute bottom-3 left-3 text-xs font-mono text-white/60">image overlay gradient</span>
                            </div>
                            <div className="relative h-32 rounded-2xl overflow-hidden bg-accent flex items-center justify-center">
                                <div className="w-16 h-16 bg-brand/20 rounded-full blur-2xl animate-blob" />
                                <span className="absolute bottom-3 left-3 text-xs font-mono text-ink-500">.animate-blob</span>
                            </div>
                        </div>
                    </section>

                    {/* ICONS */}
                    <section>
                        <SectionHeading id="icons" title="Icons" description="lucide-react — the icon set used site-wide. A representative sample." />
                        <div className="grid grid-cols-4 sm:grid-cols-8 gap-4">
                            {[Rocket, ArrowRight, ShieldCheck, Zap, Layers, BrainCircuit, CheckCircle2, Check, Info, AlertTriangle, XCircle, Facebook, Linkedin, ChevronDown, Search, Upload, LinkIcon, TableIcon].map((Icon, i) => (
                                <div key={i} className="flex items-center justify-center h-14 rounded-xl border border-ink-100 text-brand">
                                    <Icon className="w-5 h-5" />
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* COMPOSED COMPONENTS */}
                    <section>
                        <SectionHeading id="components" title="Composed Components" description="Full site sections, rendered live with sample data, exactly as they appear on real pages." />

                        <div className="space-y-16">
                            <div className="rounded-2xl overflow-hidden border border-ink-100">
                                <div className="px-6 py-3 bg-ink-50 text-xs font-semibold text-ink-500 uppercase tracking-wide">FaqSection</div>
                                <FaqSection items={faqItems} />
                            </div>

                            <div className="rounded-2xl overflow-hidden border border-ink-100">
                                <div className="px-6 py-3 bg-ink-50 text-xs font-semibold text-ink-500 uppercase tracking-wide">PricingTable</div>
                                <PricingTable plans={pricingPlans} />
                            </div>

                            <div className="rounded-2xl overflow-hidden border border-ink-100">
                                <div className="px-6 py-3 bg-ink-50 text-xs font-semibold text-ink-500 uppercase tracking-wide">ProjectFlow</div>
                                <ProjectFlow stages={flowStages} />
                            </div>

                            <div className="rounded-2xl overflow-hidden border border-ink-100">
                                <div className="px-6 py-3 bg-ink-50 text-xs font-semibold text-ink-500 uppercase tracking-wide">FeaturesGrid</div>
                                <FeaturesGrid features={['Financial Management', 'Accounts Receivable', 'Asset Management', 'Cash & Banking', 'Reporting & Analytics', 'Budgeting', 'Tax & Compliance', 'Automation']} />
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {/* FOOTER */}
            <section id="footer" className="scroll-mt-24 mt-24">
                <div className="container mx-auto px-4 md:px-6 mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold text-ink-900">Footer</h2>
                    <p className="text-ink-500 mt-2">The live Footer component, rendered as-is.</p>
                </div>
                <Footer />
            </section>
        </div>
    );
}
