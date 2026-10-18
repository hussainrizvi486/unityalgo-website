'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import {
    Rocket, ArrowRight, ArrowUpRight, ShieldCheck, Zap, Layers, BrainCircuit,
    CheckCircle2, Check, Info, AlertTriangle, XCircle, Facebook, Linkedin,
    ChevronDown, Search, Upload, Link as LinkIcon, Table as TableIcon,
    UserRound, CalendarDays, CircleCheck, Boxes, Inbox,
    MoreHorizontal, Pencil, Trash2, Copy, Download, LogOut, Settings,
    Eye, Plus, Loader2, CreditCard, TrendingUp, TrendingDown, Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
    Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { PasswordInput } from '@/components/ui/password-input';
import { SmartInput } from '@/components/ui/smart-input';
import { Notice } from '@/components/ui/notice';
import { FormField } from '@/components/ui/form-field';
import { Switch } from '@/components/ui/switch';
import { Autocomplete } from '@/components/ui/autocomplete';
import {
    DropdownMenu, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { AdminDynamicForm, type AdminFormField } from '@/components/admin/dynamic-form';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { AvatarInitials } from '@/components/admin/avatar-initials';
import { FilterPills } from '@/components/admin/filter-pills';
import { AdminPageHeader, AdminPageError, AdminPageNotice } from '@/components/admin/page-header';
import { AdminListView, renderedColumn, type ListViewColumn } from '@/components/admin/list-view';
import { ActionsCell, AvatarCell, BadgeCell, MutedCell } from '@/components/admin/grid-cells';
import { ControllerOffline } from '@/components/admin/controller-offline';
import { TokenReference } from './token-reference';
import { Logo } from '@/components/Logo';
import { Footer } from '@/components/layouts/footer';
import { FaqSection } from '@/components/website/faq-section';
import { PricingTable } from '@/components/website/pricing-table';
import { ProjectFlow } from '@/components/website/project-flow';
import { FeaturesGrid } from '@/components/website/features-grid';
import { AdminPagination } from '@/components/admin/pagination';
import { cn } from '@/utils';

const navGroups = [
    {
        label: 'Foundations',
        sections: [
            { id: 'overview', label: 'Overview' },
            { id: 'branding', label: 'Logo & Branding' },
            { id: 'colors', label: 'Design tokens' },
            { id: 'typography', label: 'Typography' },
            { id: 'borders', label: 'Borders & Radius' },
            { id: 'shadows', label: 'Shadows' },
            { id: 'spacing', label: 'Spacing Scale' },
            { id: 'surfaces', label: 'Surfaces & Background Colors' },
            { id: 'backgrounds', label: 'Decorative Backgrounds' },
            { id: 'icons', label: 'Icons' },
        ],
    },
    {
        label: 'Components',
        sections: [
            { id: 'buttons', label: 'Buttons' },
            { id: 'forms', label: 'Text Inputs & Fields' },
            { id: 'numeric', label: 'Numeric & Currency Inputs' },
            { id: 'choice', label: 'Selects & Autocomplete' },
            { id: 'toggles', label: 'Checkboxes & Switches' },
            { id: 'formlayout', label: 'Full Form Layout' },
            { id: 'menus', label: 'Dropdowns & Menus' },
            { id: 'badges', label: 'Badges & Tags' },
            { id: 'alerts', label: 'Alerts' },
            { id: 'cards', label: 'Cards' },
            { id: 'sections', label: 'Sections & Page Shells' },
            { id: 'tabs', label: 'Tabs' },
            { id: 'feedback', label: 'Tooltip & Skeleton' },
            { id: 'accordion', label: 'Accordion' },
            { id: 'overlays', label: 'Modals, Sheets & Popovers' },
            { id: 'navigation', label: 'Navigation' },
        ],
    },
    {
        label: 'Admin patterns',
        sections: [
            { id: 'listview', label: 'List View (AG Grid)' },
            { id: 'tables', label: 'Static Table' },
            { id: 'states', label: 'Empty & Error States' },
        ],
    },
    {
        label: 'Composed',
        sections: [
            { id: 'components', label: 'Site Sections' },
            { id: 'footer', label: 'Footer' },
        ],
    },
];

function SectionHeading({
    id,
    title,
    description,
    source,
}: {
    id: string;
    title: string;
    description?: string;
    source?: string;
}) {
    return (
        <div id={id} className="scroll-mt-24 mb-8">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">{title}</h2>
                {source && (
                    <code className="font-mono text-xs text-muted-foreground">{source}</code>
                )}
            </div>
            {description && <p className="text-muted-foreground mt-2 max-w-2xl leading-relaxed">{description}</p>}
        </div>
    );
}

function Spec({
    label,
    hint,
    children,
    surface = 'plain',
    className,
}: {
    label?: string;
    hint?: string;
    children: React.ReactNode;
    /** `panel` puts the demo on a bordered card — use when the component is white. */
    surface?: 'plain' | 'panel' | 'muted';
    className?: string;
}) {
    return (
        <div className={cn('min-w-0', className)}>
            {label && (
                <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2">
                    <span className="text-xs font-semibold text-foreground/70">{label}</span>
                    {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
                </div>
            )}
            <div
                className={cn(
                    surface === 'panel' && 'rounded-xl border border-border bg-card p-5',
                    surface === 'muted' && 'rounded-xl border border-border/60 bg-muted p-5',
                )}
            >
                {children}
            </div>
        </div>
    );
}

function SubHeading({ label, description }: { label: string; description?: string }) {
    return (
        <div className="mb-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</h3>
            {description && <p className="text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">{description}</p>}
        </div>
    );
}

interface DemoRow {
    id: string;
    name: string;
    email: string;
    plan: string;
    status: 'Active' | 'Pending' | 'Paused';
    created: string;
}

const demoRows: DemoRow[] = [
    { id: '1', name: 'Ada Lovelace', email: 'ada@northandco.com', plan: 'Scale', status: 'Active', created: 'Aug 2, 2026' },
    { id: '2', name: 'Grace Hopper', email: 'grace@harbourgoods.com', plan: 'Launch', status: 'Active', created: 'Jul 28, 2026' },
    { id: '3', name: 'Alan Turing', email: 'alan@bletchley.io', plan: 'Enterprise', status: 'Pending', created: 'Jul 19, 2026' },
    { id: '4', name: 'Katherine Johnson', email: 'kj@orbital.store', plan: 'Scale', status: 'Active', created: 'Jul 4, 2026' },
    { id: '5', name: 'Barbara Liskov', email: 'barbara@substitution.co', plan: 'Launch', status: 'Paused', created: 'Jun 22, 2026' },
    { id: '6', name: 'Linus Torvalds', email: 'linus@kernel.shop', plan: 'Launch', status: 'Active', created: 'Jun 11, 2026' },
];

const DEMO_STATUS_VARIANT = {
    Active: 'success',
    Pending: 'warning',
    Paused: 'neutral',
} as const;

function ListViewDemo() {
    const columns: ListViewColumn<DemoRow>[] = [
        renderedColumn<DemoRow, { primary: string; secondary: string }>({
            headerName: 'Customer',
            icon: <UserRound />,
            flex: 1.6,
            minWidth: 210,
            cellRenderer: AvatarCell,
            text: (row) => row.name,
            get: (row) => ({ primary: row.name, secondary: row.email }),
        }),
        {
            headerName: 'Plan',
            icon: <Layers />,
            width: 150,
            cellRenderer: MutedCell,
            valueGetter: (p) => p.data?.plan,
        },
        renderedColumn<DemoRow, { label: string; variant: 'success' | 'warning' | 'neutral' }>({
            headerName: 'Status',
            icon: <CircleCheck />,
            width: 150,
            cellRenderer: BadgeCell,
            text: (row) => row.status,
            get: (row) => ({ label: row.status, variant: DEMO_STATUS_VARIANT[row.status] }),
        }),
        {
            headerName: 'Created',
            icon: <CalendarDays />,
            width: 160,
            cellRenderer: MutedCell,
            valueGetter: (p) => p.data?.created,
        },
        renderedColumn<DemoRow, { actions: { label: string; href: string }[] }>({
            headerName: 'Actions',
            headerAlign: 'right',
            width: 130,
            sortable: false,
            resizable: false,
            pinned: 'right',
            cellRenderer: ActionsCell,
            get: () => ({ actions: [{ label: 'Manage', href: '#listview' }] }),
        }),
    ];

    return (
        <AdminListView
            rows={demoRows}
            columns={columns}
            getRowId={(row) => row.id}
            searchPlaceholder="Search customers…"
            pageSize={25}
            height={420}
        />
    );
}

/** FilterPills is controlled, so the specimen owns the selection. */
function FilterPillsDemo() {
    const [value, setValue] = useState('all');
    return (
        <FilterPills
            label="Filter by status"
            value={value}
            onChange={setValue}
            options={[
                { value: 'all', label: 'All', count: 24 },
                { value: 'active', label: 'Active', count: 18 },
                { value: 'pending', label: 'Pending', count: 4 },
                { value: 'paused', label: 'Paused', count: 2 },
            ]}
        />
    );
}

const countryOptions = [
    { value: 'pk', label: 'Pakistan' },
    { value: 'ae', label: 'United Arab Emirates' },
    { value: 'sa', label: 'Saudi Arabia' },
    { value: 'gb', label: 'United Kingdom' },
    { value: 'us', label: 'United States' },
    { value: 'ca', label: 'Canada' },
    { value: 'au', label: 'Australia' },
    { value: 'de', label: 'Germany' },
    { value: 'fr', label: 'France' },
    { value: 'nl', label: 'Netherlands' },
    { value: 'sg', label: 'Singapore' },
    { value: 'my', label: 'Malaysia' },
    { value: 'in', label: 'India' },
    { value: 'bd', label: 'Bangladesh' },
    { value: 'tr', label: 'Turkey' },
    { value: 'za', label: 'South Africa' },
];

/** Two-line options — the case where a bare label would be ambiguous. */
const customerOptions = [
    { value: 'c1', label: 'Ada Lovelace', description: 'ada@northandco.com · Scale' },
    { value: 'c2', label: 'Grace Hopper', description: 'grace@harbourgoods.com · Launch' },
    { value: 'c3', label: 'Alan Turing', description: 'alan@bletchley.io · Enterprise' },
    { value: 'c4', label: 'Katherine Johnson', description: 'kj@orbital.store · Scale' },
    { value: 'c5', label: 'Barbara Liskov', description: 'barbara@substitution.co · Launch (paused)' },
    { value: 'c6', label: 'Radia Perlman', description: 'radia@spanningtree.net · Enterprise' },
];

const demoFormFields: AdminFormField[] = [
    { type: 'tab', label: 'Details' },
    { type: 'section', label: 'Identity', description: 'What this plan is called and where it sits in the list.' },
    { type: 'column' },
    { type: 'text', name: 'demoName', label: 'Plan name', required: true, defaultValue: 'Scale' },
    { type: 'select', name: 'demoProduct', label: 'Product', required: true, defaultValue: 'commerce', options: [
        { value: 'commerce', label: 'UnityCommerce' },
        { value: 'algosuite', label: 'AlgoSuite' },
    ] },
    { type: 'column' },
    { type: 'text', name: 'demoSlug', label: 'Slug', required: true, defaultValue: 'scale', help: 'Lower-case, used in the URL.' },
    { type: 'integer', name: 'demoSort', label: 'Sort order', defaultValue: 20, min: 0 },
    { type: 'section', label: 'Pricing' },
    { type: 'column' },
    { type: 'currency', name: 'demoPrice', label: 'Price', required: true, defaultValue: 4999, symbol: '$', numberFormat: '#,###.##' },
    { type: 'column' },
    { type: 'percent', name: 'demoFee', label: 'Transaction fee', defaultValue: 2.5, decimals: 1, min: 0, max: 100 },
    { type: 'section' },
    { type: 'textarea', name: 'demoSummary', label: 'Summary', rows: 3, fullWidth: true, defaultValue: 'For stores outgrowing a single warehouse.', help: 'Shown on the pricing table.' },
    { type: 'checkbox', name: 'demoFeatured', label: 'Feature on the pricing table', defaultChecked: true, help: 'Only one plan per product can be featured.' },

    { type: 'tab', label: 'Limits' },
    { type: 'section', label: 'Quotas', description: 'Leave blank for unlimited.' },
    { type: 'column' },
    { type: 'integer', name: 'demoUsers', label: 'User limit', defaultValue: 25, min: 1 },
    { type: 'column' },
    { type: 'integer', name: 'demoOrders', label: 'Monthly orders', defaultValue: 50000, min: 0 },
];

async function demoFormAction(): Promise<{ success: string }> {
    await new Promise((resolve) => setTimeout(resolve, 900));
    return { success: 'Saved. (Preview only — nothing was written.)' };
}

function CodeLabel({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <code className={cn('inline-block text-xs bg-secondary text-foreground/70 rounded px-1.5 py-0.5 font-mono', className)}>
            {children}
        </code>
    );
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

export default function ThemePreviewRoute() {
    return (
        <Suspense>
            <ThemePreviewPage />
        </Suspense>
    );
}

function ThemePreviewPage() {
    const [dialogOpen, setDialogOpen] = useState(false);

    return (
        <div className="bg-background text-foreground min-h-screen">
            {/* --- PAGE HEADER --- */}
            <div className="border-b border-border/60 bg-card/80 backdrop-blur-md sticky top-0 z-40">
                <div className="site-container site-gutters py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Logo className="h-9" />
                        <span className="text-sm font-semibold text-muted-foreground hidden sm:inline">/ Theme Preview</span>
                    </div>
                    <Link href="/" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
                        Back to site <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </div>

            <div className="site-container site-gutters py-10 flex gap-10">
                {/* --- STICKY TOC --- */}
                <nav className="hidden lg:block w-60 shrink-0">
                    <div className="sticky top-24 max-h-[calc(100vh-var(--header-h)-var(--gap))] overflow-y-auto pb-6 space-y-5">
                        {navGroups.map((group) => (
                            <div key={group.label} className="space-y-0.5">
                                <p className="mb-1.5 flex items-baseline justify-between px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    {group.label}
                                    <span className="font-mono text-micro text-muted-foreground/50">{group.sections.length}</span>
                                </p>
                                {group.sections.map((s) => (
                                    <a
                                        key={s.id}
                                        href={`#${s.id}`}
                                        className="block rounded-md px-3 py-1.5 text-sm text-foreground/70 transition-colors hover:bg-secondary hover:text-foreground"
                                    >
                                        {s.label}
                                    </a>
                                ))}
                            </div>
                        ))}
                    </div>
                </nav>

                {/* --- CONTENT --- */}
                <div className="flex-1 min-w-0 space-y-24">
                    {/* OVERVIEW */}
                    <section id="overview" className="scroll-mt-24">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent border border-primary/15 mb-6">
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            <span className="text-xs font-semibold text-primary tracking-wide uppercase">Design System</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4 text-balance">
                            UnityAlgo Theme Preview
                        </h1>
                        <p className="text-lg text-foreground/70 max-w-2xl leading-relaxed">
                            Every color, type style, and component used across the site, in one place — a living reference
                            for reviewing consistency and branding as the product grows.
                        </p>
                    </section>

                    {/* LOGO & BRANDING */}
                    <section>
                        <SectionHeading id="branding" title="Logo & Branding" source="components/Logo.tsx" description="components/Logo.tsx — Poppins wordmark + SVG mark, two size presets used across the site." />
                        <div className="grid sm:grid-cols-2 gap-6">
                            <div className="flex flex-col items-start gap-4 p-8 rounded-xl border border-border/60 bg-card">
                                <Logo className="h-12" />
                                <CodeLabel>{'<Logo className="h-12" />'}</CodeLabel>
                                <span className="text-xs text-muted-foreground">Used in Header</span>
                            </div>
                            <div className="flex flex-col items-start gap-4 p-8 rounded-xl bg-primary">
                                <Logo className="h-10" />
                                <CodeLabel>{'<Logo className="h-10" />'}</CodeLabel>
                                <span className="text-xs text-primary-foreground/50">Used in Footer, on dark background</span>
                            </div>
                        </div>
                    </section>

                    {/* TOKENS */}
                    <section>
                        <SectionHeading id="colors" title="Design tokens" source="app/globals.css" description="Every colour, size, space, radius, weight and shadow comes from the token block at the top of app/globals.css: :root for the public site, .dashboard for the customer portal and admin panel, .dashboard.dark for dark mode. Nothing below is copied; each value is read live." />
                        <TokenReference />
                    </section>

                    {/* TYPOGRAPHY */}
                    <section>
                        <SectionHeading id="typography" title="Typography" description="Geist everywhere — body{} and h1,h2,h3{} both reference next/font's --font-geist variable. The wordmark alone pins Poppins via the .font-logo utility. .font-display is an opt-in hook for a hero display face, but no dedicated display font is loaded today, so it falls back to Geist." />
                        <div className="space-y-5 p-8 rounded-xl border border-border/60 bg-card">
                            <div>
                                <h1 className="text-5xl font-bold tracking-tight text-foreground">Heading 1 / text-5xl</h1>
                                <CodeLabel className="mt-2">font-bold · text-5xl</CodeLabel>
                            </div>
                            <div>
                                <h2 className="text-4xl font-bold text-foreground">Heading 2 / text-4xl</h2>
                                <CodeLabel className="mt-2">font-bold · text-4xl</CodeLabel>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-foreground">Heading 3 / text-2xl</h3>
                                <CodeLabel className="mt-2">font-bold · text-2xl</CodeLabel>
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-foreground">Heading 4 / text-lg</h4>
                                <CodeLabel className="mt-2">font-bold · text-lg</CodeLabel>
                            </div>
                            <div>
                                <p className="text-xl text-foreground/70 leading-relaxed">
                                    Lead paragraph / text-xl — used under hero headings to set up the value proposition.
                                </p>
                            </div>
                            <div>
                                <p className="text-base text-foreground/70 leading-relaxed">
                                    Body text / text-base — the default reading size for paragraphs across marketing pages.
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Small / text-sm — captions, meta info, helper text.</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Eyebrow / text-xs uppercase tracking-widest</p>
                            </div>
                            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-5 border-t border-border/60">
                                <span className="font-light">Light 300</span>
                                <span className="font-normal">Regular 400</span>
                                <span className="font-medium">Medium 500</span>
                                <span className="font-semibold">Semibold 600</span>
                                <span className="font-bold">Bold 700</span>
                            </div>
                            <div>
                                <Link href="#" className="text-primary hover:underline font-semibold">Link text example →</Link>
                            </div>
                        </div>
                    </section>

                    {/* BUTTONS */}
                    <section>
                        <SectionHeading id="buttons" title="Buttons" source="components/ui/button.tsx" description="components/ui/button.tsx — variant × size matrix, plus real button treatments used on marketing pages." />

                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm mb-8">
                                <thead>
                                    <tr className="text-left text-muted-foreground text-xs uppercase tracking-wide">
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
                                        <tr key={variant} className="border-t border-border/60">
                                            <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{variant}</td>
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

                        <SubHeading label="Real treatments used on marketing pages" />
                        <div className="flex flex-wrap items-center gap-3">
                            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-foreground/10 hover:scale-105 transition-all">
                                Get Started <ArrowRight className="ml-1 size-4" />
                            </Button>
                            <Button variant="outline" size="lg" className="bg-card/60 backdrop-blur-md shadow-md border-input hover:bg-card">
                                Our Services
                            </Button>
                            {}
                            <div className="flex items-center rounded-xl bg-primary px-4 py-3">
                                <Button className="bg-card text-foreground hover:bg-secondary">CTA on dark background</Button>
                            </div>
                            <Button variant="ghost" className="rounded hover:bg-secondary text-foreground/70">
                                Learn more <ArrowUpRight className="ml-1 w-4 h-4" />
                            </Button>
                        </div>

                        <div className="mt-10 grid gap-8 lg:grid-cols-2">
                            <div>
                                <SubHeading
                                    label="With icons"
                                    description="A leading icon labels the action; a trailing one points at what happens next. Both are sized by the button, not the icon — button.tsx sets [&_svg]:size-4."
                                />
                                <div className="flex flex-wrap items-center gap-3">
                                    <Button><Plus /> New record</Button>
                                    <Button variant="outline"><Download /> Export</Button>
                                    <Button variant="secondary">Continue <ArrowRight /></Button>
                                    <Button variant="ghost" size="icon" aria-label="Edit"><Pencil /></Button>
                                    <Button variant="outline" size="icon" aria-label="More"><MoreHorizontal /></Button>
                                </div>
                            </div>

                            <div>
                                <SubHeading
                                    label="Busy and blocked"
                                    description="A submitting button keeps its label and disables itself, so the row neither reflows nor accepts a second click. This is what useFormStatus drives in every admin form."
                                />
                                <div className="flex flex-wrap items-center gap-3">
                                    <Button disabled><Loader2 className="animate-spin" /> Saving…</Button>
                                    <Button variant="outline" disabled><Loader2 className="animate-spin" /> Checking…</Button>
                                    <Button variant="destructive" disabled>Delete</Button>
                                </div>
                            </div>

                            <div>
                                <SubHeading label="Grouped" description="Segmented actions share one border; the divider is the neighbour's edge, not an extra element." />
                                <div className="inline-flex rounded border border-input overflow-hidden">
                                    <button type="button" className="px-3 py-1.5 text-sm bg-primary text-primary-foreground">Day</button>
                                    <button type="button" className="px-3 py-1.5 text-sm border-l border-input hover:bg-muted">Week</button>
                                    <button type="button" className="px-3 py-1.5 text-sm border-l border-input hover:bg-muted">Month</button>
                                </div>
                            </div>

                            <div>
                                <SubHeading label="Full width" description="Used in the login card and in narrow drawers, where a button that hugs its label reads as unfinished." />
                                <div className="max-w-xs space-y-2.5">
                                    <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">Sign in</Button>
                                    <Button variant="outline" className="w-full">Create an account</Button>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* TEXT INPUTS */}
                    <section>
                        <SectionHeading
                            id="forms"
                            title="Text Inputs & Fields"
                            source="components/ui/input.tsx · textarea.tsx · password-input.tsx · label.tsx"
                            description="The text controls, every state they can be in, and the label/help/error scaffolding that surrounds them in a real form."
                        />

                        <SubHeading
                            label="States"
                            description="Every text control carries the same four. Invalid is driven by aria-invalid, so the styling and the accessibility signal cannot drift apart — there is no separate isError prop to forget."
                        />
                        <div className="mb-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            <Spec label="Default">
                                <Input placeholder="you@example.com" />
                            </Spec>
                            <Spec label="Focus" hint="click in">
                                <Input placeholder="Focus ring: 3px" />
                            </Spec>
                            <Spec label="Disabled">
                                <Input placeholder="Disabled" disabled />
                            </Spec>
                            <Spec label="Invalid" hint="aria-invalid">
                                <Input placeholder="Invalid value" aria-invalid />
                            </Spec>
                        </div>

                        <SubHeading
                            label="Anatomy"
                            description="Label, control, and one line of supporting text. Help and error occupy the same slot — a field shows one or the other, never both, so the row below the input never changes height."
                        />
                        <div className="mb-10 grid gap-6 md:grid-cols-3">
                            <div>
                                <Label htmlFor="tp-anatomy-1" className="mb-1.5 text-sm text-foreground/80">Company name</Label>
                                <Input id="tp-anatomy-1" defaultValue="North &amp; Co." />
                                <p className="mt-1.5 text-xs text-muted-foreground">Appears on invoices.</p>
                            </div>
                            <div>
                                <Label htmlFor="tp-anatomy-2" className="mb-1.5 text-sm text-foreground/80">
                                    Company name <span className="font-normal text-muted-foreground">(optional)</span>
                                </Label>
                                <Input id="tp-anatomy-2" placeholder="North &amp; Co." />
                                <p className="mt-1.5 text-xs text-muted-foreground">Optional is marked on the label, not the placeholder.</p>
                            </div>
                            <div>
                                <Label htmlFor="tp-anatomy-3" className="mb-1.5 text-sm text-foreground/80">Company name</Label>
                                <Input id="tp-anatomy-3" defaultValue="!!" aria-invalid aria-describedby="tp-anatomy-3-error" />
                                <p id="tp-anatomy-3-error" role="alert" className="mt-1.5 text-xs text-destructive">
                                    Enter at least two characters.
                                </p>
                            </div>
                        </div>

                        <SubHeading label="Adornments" description="An icon, a unit, or a button can sit inside the field. The control keeps its own padding; the decoration is positioned over it." />
                        <div className="mb-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            <Spec label="Leading icon" hint="admin search">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input placeholder="Search…" className="pl-9" />
                                </div>
                            </Spec>
                            <Spec label="Trailing unit">
                                <div className="relative">
                                    <Input defaultValue="30" className="pr-14 tabular-nums" />
                                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">days</span>
                                </div>
                            </Spec>
                            <Spec label="Prefix">
                                <div className="flex">
                                    <span className="inline-flex items-center rounded-l border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                                        https://
                                    </span>
                                    <Input defaultValue="northandco.com" className="rounded-l-none" />
                                </div>
                            </Spec>
                            <Spec label="Inline action">
                                <div className="relative">
                                    <Input readOnly value="sk_live_9f2c…a41" className="pr-10 font-mono text-xs" />
                                    <button type="button" aria-label="Copy" className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground/80">
                                        <Copy className="size-3.5" />
                                    </button>
                                </div>
                            </Spec>
                            <Spec label="Password" hint="components/ui/password-input.tsx">
                                <PasswordInput placeholder="••••••••" />
                            </Spec>
                            <Spec label="Read-only" hint="not the same as disabled — it is still focusable and copyable">
                                <Input readOnly value="cus_7Kd91mQ" className="font-mono" />
                            </Spec>
                        </div>

                        <SubHeading label="Multi-line and specialised" />
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-5">
                                <div>
                                    <Label className="mb-1.5 text-sm text-foreground/80">Textarea</Label>
                                    <Textarea rows={4} placeholder="Tell us about your project…" />
                                </div>
                                <div>
                                    <Label className="mb-1.5 text-sm text-foreground/80">Textarea — invalid</Label>
                                    <Textarea rows={3} defaultValue="Too short" aria-invalid />
                                </div>
                            </div>
                            <div className="space-y-5">
                                <div>
                                    <Label className="mb-1.5 text-sm text-foreground/80">Colour field <span className="font-normal text-muted-foreground">(admin)</span></Label>
                                    <div className="flex items-center gap-2">
                                        <div className="size-9 shrink-0 rounded border border-input bg-primary" />
                                        <Input value="--primary" readOnly className="font-mono" />
                                    </div>
                                </div>
                                <div>
                                    <Label className="mb-1.5 text-sm text-foreground/80">Upload field <span className="font-normal text-muted-foreground">(admin)</span></Label>
                                    <div className="flex items-center gap-3">
                                        <Button type="button" variant="outline"><Upload className="size-3.5" /> Choose file</Button>
                                        <span className="text-xs text-muted-foreground">No file selected</span>
                                    </div>
                                </div>
                                <div>
                                    <Label className="mb-1.5 text-sm text-foreground/80">Date</Label>
                                    <Input type="date" defaultValue="2026-09-01" />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* NUMERIC INPUTS */}
                    <section>
                        <SectionHeading
                            id="numeric"
                            title="Numeric & Currency Inputs"
                            source="components/ui/smart-input.tsx · lib/numeric-input.ts"
                            description="One component covers whole numbers, decimals, money and percentages. It is always type=text — type=number cannot show a grouping separator or a symbol, and hands back an empty string for anything the browser dislikes, so a mistyped value is indistinguishable from a cleared one."
                        />

                        <div className="mb-8 rounded-xl border border-border bg-muted px-5 py-4 text-sm text-foreground/70">
                            <p className="font-semibold text-foreground">Click into any field below to see the difference.</p>
                            <p className="mt-1 leading-relaxed">
                                Formatting appears on blur and disappears on focus, so separators never shuffle under the caret
                                mid-word. Whatever it displays, the value posted to the server is always plain —
                                <code className="mx-1 font-mono text-xs text-muted-foreground">1234.5</code>
                                — carried on a hidden input beside the visible one.
                            </p>
                        </div>

                        <SubHeading label="Currency" description="Grouping, symbol and precision all come from the currency's own numberFormat pattern, so a plan priced in rupees groups in lakhs without any per-field configuration." />
                        <div className="mb-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                            <Spec label="US dollar" hint="#,###.##">
                                <SmartInput name="tp-usd" kind="currency" symbol="$" numberFormat="#,###.##" defaultValue="1234567.89" />
                            </Spec>
                            <Spec label="Pakistani rupee" hint="#,##,###.## — lakhs">
                                <SmartInput name="tp-pkr" kind="currency" symbol="Rs" numberFormat="#,##,###.##" defaultValue="1234567.89" />
                            </Spec>
                            <Spec label="Euro" hint="#.###,## — swapped separators">
                                <SmartInput name="tp-eur" kind="currency" symbol="€" numberFormat="#.###,##" defaultValue="1234567.89" />
                            </Spec>
                            <Spec label="Empty" hint="posts nothing, not zero">
                                <SmartInput name="tp-empty" kind="currency" symbol="$" numberFormat="#,###.##" placeholder="0.00" />
                            </Spec>
                        </div>

                        <SubHeading label="Other numeric kinds" />
                        <div className="mb-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                            <Spec label="Whole number" hint="kind='integer'">
                                <SmartInput name="tp-int" kind="integer" defaultValue="1234" />
                            </Spec>
                            <Spec label="Decimal" hint="invents no trailing zeros">
                                <SmartInput name="tp-dec" kind="decimal" defaultValue="12.5" />
                            </Spec>
                            <Spec label="Percent" hint="kind='percent'">
                                <SmartInput name="tp-pct" kind="percent" decimals={1} defaultValue="2.5" />
                            </Spec>
                            <Spec label="Negative allowed" hint="opt-in">
                                <SmartInput name="tp-neg" kind="currency" symbol="$" numberFormat="#,###.##" allowNegative defaultValue="-1500.5" />
                            </Spec>
                        </div>

                        <SubHeading label="Validation" description="Range and completeness are checked on blur, once the field has been touched — a required field does not shout at someone who has not reached it yet." />
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            <Spec label="Out of range" hint="type 70000, then click away">
                                <SmartInput name="tp-port" kind="integer" min={1} max={65535} defaultValue="70000" />
                            </Spec>
                            <Spec label="In range">
                                <SmartInput name="tp-port-ok" kind="integer" min={1} max={65535} defaultValue="587" />
                            </Spec>
                            <Spec label="Disabled">
                                <SmartInput name="tp-num-disabled" kind="currency" symbol="$" numberFormat="#,###.##" defaultValue="49" disabled />
                            </Spec>
                        </div>
                    </section>

                    {/* SELECTS & AUTOCOMPLETE */}
                    <section>
                        <SectionHeading
                            id="choice"
                            title="Selects & Autocomplete"
                            source="components/ui/select.tsx · autocomplete.tsx"
                            description="Three ways to choose from a list, in ascending order of how long the list is: a native select for admin filters, a Radix select for a handful of options, and a filtering autocomplete once the list is longer than anyone will scroll."
                        />

                        <SubHeading label="Radix select" description="components/ui/select.tsx — the styled select used in forms. Opens in a portal, so it is never clipped by an overflow-hidden card." />
                        <div className="mb-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                            <Spec label="Placeholder">
                                <Select>
                                    <SelectTrigger><SelectValue placeholder="Choose a plan" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="launch">Launch</SelectItem>
                                        <SelectItem value="scale">Scale</SelectItem>
                                        <SelectItem value="enterprise">Enterprise</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Spec>
                            <Spec label="Chosen">
                                <Select defaultValue="scale">
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="launch">Launch</SelectItem>
                                        <SelectItem value="scale">Scale</SelectItem>
                                        <SelectItem value="enterprise">Enterprise</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Spec>
                            <Spec label="Disabled">
                                <Select disabled defaultValue="launch">
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="launch">Launch</SelectItem></SelectContent>
                                </Select>
                            </Spec>
                            <Spec label="Invalid" hint="aria-invalid">
                                <Select>
                                    <SelectTrigger aria-invalid><SelectValue placeholder="Required" /></SelectTrigger>
                                    <SelectContent><SelectItem value="launch">Launch</SelectItem></SelectContent>
                                </Select>
                            </Spec>
                        </div>

                        <div className="mb-10 grid gap-6 md:grid-cols-2">
                            <Spec label="Long list" hint="scrolls at 12 items — open it">
                                <Select>
                                    <SelectTrigger><SelectValue placeholder="Choose a country" /></SelectTrigger>
                                    <SelectContent>
                                        {countryOptions.map((country) => (
                                            <SelectItem key={country.value} value={country.value}>{country.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Spec>
                            <Spec label="Native select" hint="admin filter bars — kept native so it posts without JS">
                                <select className="h-9 w-full rounded border border-input bg-card px-3 text-sm">
                                    <option>All statuses</option>
                                    <option>Published</option>
                                    <option>Draft</option>
                                    <option>Archived</option>
                                </select>
                            </Spec>
                        </div>

                        <SubHeading
                            label="Autocomplete"
                            description="components/ui/autocomplete.tsx — type to filter, ↑/↓ to move, Enter to choose, Esc to close. Posts the option's value on a hidden input, exactly like SmartInput, so a form receives 'pk' rather than the 'Pakistan' that was read."
                        />
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            <Spec label="Empty" hint="try typing 'pak'">
                                <Autocomplete name="tp-ac-1" options={countryOptions} placeholder="Search countries…" />
                            </Spec>
                            <Spec label="Preselected">
                                <Autocomplete name="tp-ac-2" options={countryOptions} defaultValue="pk" />
                            </Spec>
                            <Spec label="Rich options" hint="two-line entries">
                                <Autocomplete name="tp-ac-3" options={customerOptions} placeholder="Search customers…" />
                            </Spec>
                            <Spec label="No matches" hint="type 'zzz'">
                                <Autocomplete name="tp-ac-4" options={countryOptions} emptyMessage="No country matches that." />
                            </Spec>
                            <Spec label="Invalid">
                                <Autocomplete name="tp-ac-5" options={countryOptions} invalid />
                            </Spec>
                            <Spec label="Disabled">
                                <Autocomplete name="tp-ac-6" options={countryOptions} defaultValue="pk" disabled />
                            </Spec>
                        </div>
                    </section>

                    {/* TOGGLES */}
                    <section>
                        <SectionHeading
                            id="toggles"
                            title="Checkboxes & Switches"
                            source="components/ui/checkbox.tsx · switch.tsx"
                            description="Binary controls and the label patterns around them. A checkbox with a second explanatory line is the shape most admin settings take."
                        />

                        <SubHeading label="Checkbox states" />
                        <div className="mb-10 flex flex-wrap items-center gap-x-10 gap-y-4">
                            <label className="flex items-center gap-2.5 text-sm text-foreground/80">
                                <Checkbox defaultChecked /> Checked
                            </label>
                            <label className="flex items-center gap-2.5 text-sm text-foreground/80">
                                <Checkbox /> Unchecked
                            </label>
                            <label className="flex items-center gap-2.5 text-sm text-muted-foreground">
                                <Checkbox disabled defaultChecked /> Disabled, checked
                            </label>
                            <label className="flex items-center gap-2.5 text-sm text-muted-foreground">
                                <Checkbox disabled /> Disabled
                            </label>
                        </div>

                        <SubHeading
                            label="Switch"
                            description="components/ui/switch.tsx — for a change that applies the moment it is thrown. A checkbox proposes a value that takes effect on Save; a switch is the action itself, so use it for a billing period or a live/paused state, not for a field in a form with a Save button."
                        />
                        <div className="mb-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                            <Spec label="Off / on" hint="click either">
                                <div className="flex items-center gap-4">
                                    <Switch aria-label="Example off" />
                                    <Switch defaultChecked aria-label="Example on" />
                                </div>
                            </Spec>
                            <Spec label="Small" hint="size=&quot;sm&quot;">
                                <div className="flex items-center gap-4">
                                    <Switch size="sm" aria-label="Small off" />
                                    <Switch size="sm" defaultChecked aria-label="Small on" />
                                </div>
                            </Spec>
                            <Spec label="Disabled">
                                <div className="flex items-center gap-4">
                                    <Switch disabled aria-label="Disabled off" />
                                    <Switch disabled defaultChecked aria-label="Disabled on" />
                                </div>
                            </Spec>
                            <Spec label="On a dark ground" hint="tone=&quot;dark&quot;">
                                <div className="flex items-center gap-4 rounded-lg bg-primary px-4 py-3">
                                    <Switch tone="dark" aria-label="Dark off" />
                                    <Switch tone="dark" defaultChecked aria-label="Dark on" />
                                </div>
                            </Spec>
                        </div>

                        <SubHeading label="With a label" description="The switch is the control, so the whole row is the label — clicking the text throws it too." />
                        <div className="mb-10 max-w-2xl divide-y divide-border/60 rounded-xl border border-border">
                            {[
                                { id: 'tp-sw-1', title: 'Annual billing', body: 'Roughly two months free compared with monthly.', on: true },
                                { id: 'tp-sw-2', title: 'Email me about new features', body: 'Product announcements only. Never more than once a month.', on: false },
                            ].map((row) => (
                                <label key={row.id} htmlFor={row.id} className="flex items-start justify-between gap-6 px-5 py-4 text-sm text-foreground/80">
                                    <span>
                                        {row.title}
                                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{row.body}</span>
                                    </span>
                                    <Switch id={row.id} defaultChecked={row.on} className="mt-0.5" />
                                </label>
                            ))}
                        </div>

                        <SubHeading label="Setting rows" description="The pattern used throughout the admin panel: the constraint or consequence sits under the label, at 12px, rather than in a tooltip nobody opens." />
                        <div className="max-w-2xl divide-y divide-border/60 rounded-xl border border-border">
                            {[
                                { title: 'Use as the default account', body: 'Any purpose without its own mailbox sends from here. Only one account can be the default.', checked: true },
                                { title: 'Implicit TLS', body: 'On for port 465. Leave off for 587 and 25, which start plaintext and upgrade via STARTTLS.', checked: false },
                                { title: 'Active', body: 'Inactive accounts are kept but never selected for sending.', checked: true },
                            ].map((row) => (
                                <label key={row.title} className="flex items-start gap-3 px-5 py-4 text-sm text-foreground/80">
                                    <Checkbox defaultChecked={row.checked} className="mt-0.5" />
                                    <span>
                                        {row.title}
                                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{row.body}</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    </section>

                    {/* FULL FORM */}
                    <section>
                        <SectionHeading
                            id="formlayout"
                            title="Full Form Layout"
                            source="components/admin/dynamic-form.tsx"
                            description="The real AdminDynamicForm, rendered live from a field array — not a mock-up of one. Tabs, sections and columns are breaks rather than containers, so a caller lists fields in order and never closes anything. Submitting here runs a local stub instead of a server action."
                        />
                        <div className="rounded-xl border border-border bg-card p-6 md:p-8">
                            <AdminDynamicForm
                                fields={demoFormFields}
                                action={demoFormAction}
                                submitLabel="Save plan"
                                cancelHref="#formlayout"
                            />
                        </div>
                    </section>

                    {/* MENUS */}
                    <section>
                        <SectionHeading
                            id="menus"
                            title="Dropdowns & Menus"
                            source="components/ui/dropdown-menu.tsx · navigation-menu.tsx"
                            description="Action menus behind a trigger. Built on the project's Popover rather than a second Radix package — a menu is a popover plus roving arrow-key focus and the right roles. Open one and use ↑/↓."
                        />

                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            <Spec label="Row actions" hint="the “…” in a table row" surface="panel">
                                <DropdownMenu
                                    trigger={
                                        <Button variant="outline" size="icon" aria-label="Row actions">
                                            <MoreHorizontal />
                                        </Button>
                                    }
                                >
                                    <DropdownMenuItem icon={<Eye />}>View</DropdownMenuItem>
                                    <DropdownMenuItem icon={<Pencil />}>Edit</DropdownMenuItem>
                                    <DropdownMenuItem icon={<Copy />}>Duplicate</DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem icon={<Trash2 />} tone="destructive">Delete</DropdownMenuItem>
                                </DropdownMenu>
                            </Spec>

                            <Spec label="Account menu" hint="labels, separators, shortcuts" surface="panel">
                                <DropdownMenu
                                    align="start"
                                    trigger={
                                        <Button variant="ghost" className="gap-2">
                                            <AvatarInitials name="Ada Lovelace" className="size-6 text-micro" />
                                            Ada Lovelace
                                            <ChevronDown className="size-4 text-muted-foreground" />
                                        </Button>
                                    }
                                >
                                    <DropdownMenuLabel>Signed in as ada@northandco.com</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem icon={<UserRound />} shortcut="⌘P">Profile</DropdownMenuItem>
                                    <DropdownMenuItem icon={<Settings />} shortcut="⌘,">Settings</DropdownMenuItem>
                                    <DropdownMenuItem icon={<CreditCard />}>Billing</DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem icon={<LogOut />} tone="destructive">Log out</DropdownMenuItem>
                                </DropdownMenu>
                            </Spec>

                            <Spec label="With a disabled item" hint="arrow keys skip it" surface="panel">
                                <DropdownMenu
                                    trigger={<Button variant="outline">Export <ChevronDown className="size-4" /></Button>}
                                >
                                    <DropdownMenuLabel>Download as</DropdownMenuLabel>
                                    <DropdownMenuItem icon={<Download />}>CSV</DropdownMenuItem>
                                    <DropdownMenuItem icon={<Download />}>Excel</DropdownMenuItem>
                                    <DropdownMenuItem icon={<Download />} disabled>PDF — not available</DropdownMenuItem>
                                </DropdownMenu>
                            </Spec>
                        </div>
                    </section>

                    {/* BADGES */}
                    <section>
                        <SectionHeading id="badges" title="Badges & Tags" source="components/ui/badge.tsx" description="Status pills, tag chips, and eyebrow badges used across blog, admin, and marketing pages." />

                        {}
                        <SubHeading label="Status" description="The Badge component — components/ui/badge.tsx." />
                        <div className="flex flex-wrap items-center gap-3 mb-8">
                            <Badge variant="success">Published</Badge>
                            <Badge variant="neutral">Draft</Badge>
                            <Badge variant="error">Error</Badge>
                            <Badge variant="warning">Warning</Badge>
                            <Badge variant="info">Info</Badge>
                            <Badge variant="brand">Brand</Badge>
                        </div>

                        <SubHeading label="Bespoke chips" description="One-off treatments that are not the Badge component." />
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs font-semibold text-primary bg-accent border border-primary/15 rounded-full px-3 py-1 uppercase tracking-wide">Blog Tag</span>
                            <span className="px-2.5 py-1 text-xs font-medium bg-secondary rounded-full border border-border">Tech Chip</span>
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent border border-primary/15">
                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                <span className="text-xs font-semibold text-primary tracking-wide uppercase">Eyebrow Badge</span>
                            </span>
                        </div>
                    </section>

                    {/* ALERTS */}
                    <section>
                        <SectionHeading
                            id="alerts"
                            title="Alerts"
                            source="components/ui/notice.tsx"
                            description="Inline feedback, rendered by the real component. The same four states had been hand-written about thirty times across the app and had drifted on radius, icon and text weight; this is the one shape they all use now. The ARIA role follows the tone — an error interrupts a screen reader, a confirmation waits its turn — so it is not a caller's decision."
                        />
                        <div className="space-y-3">
                            <Notice tone="error">Cannot delete the last remaining admin user.</Notice>
                            <Notice tone="success">Password updated.</Notice>
                            <Notice tone="warning">Colours must be valid hex values.</Notice>
                            <Notice tone="info">Optional — leave blank to use the site default.</Notice>
                            <Notice tone="info" icon={false}>Without an icon, for a dense context.</Notice>
                        </div>

                        <div className="mt-10">
                            <SubHeading label="Field-level error" description="components/ui/form-field.tsx — label, control, and one line of supporting text. Help and error share a slot, so the row below the control never changes height when validation fires." />
                            <div className="grid max-w-2xl gap-6 sm:grid-cols-2">
                                <FormField id="tp-ff-1" label="Company name" help="Appears on invoices.">
                                    <Input id="tp-ff-1" defaultValue="North &amp; Co." />
                                </FormField>
                                <FormField id="tp-ff-2" label="Company name" error="Enter at least two characters.">
                                    <Input id="tp-ff-2" defaultValue="!" aria-invalid />
                                </FormField>
                            </div>
                        </div>
                    </section>

                    {/* CARDS */}
                    <section>
                        <SectionHeading id="cards" title="Cards" description="Every recurring card treatment in the product — the four surface styles the marketing site uses, then the admin panel's data cards." />
                        <div className="grid sm:grid-cols-2 gap-6">
                            <div className="p-8 rounded-2xl border border-border/60 hover:border-primary/25 hover:shadow-xl hover:shadow-foreground/5 transition-all duration-300">
                                <h3 className="text-lg font-bold text-foreground mb-2">Bordered Card</h3>
                                <p className="text-sm text-foreground/70">rounded-2xl · border-border/60 · hover:shadow-foreground/5</p>
                            </div>
                            <div className="p-8 rounded-2xl bg-card/60 backdrop-blur-md border border-background/60 hover:bg-card hover:border-primary/15 hover:shadow-2xl hover:shadow-foreground/5 transition-all duration-300">
                                <h3 className="text-lg font-bold text-foreground mb-2">Glass Card</h3>
                                <p className="text-sm text-foreground/70">bg-card/60 · backdrop-blur-md · border-background/60</p>
                            </div>
                            <div className="p-8 rounded bg-card shadow-sm hover:shadow-xl transition-all duration-300">
                                <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center mb-6">
                                    <Zap className="w-7 h-7 text-primary" />
                                </div>
                                <h3 className="text-lg font-bold text-foreground mb-2">Feature Card</h3>
                                <p className="text-sm text-foreground/70">rounded · shadow-sm → shadow-xl on hover</p>
                            </div>
                            <div className="p-8 rounded-2xl bg-gradient-to-br from-primary to-scrim text-primary-foreground">
                                <h3 className="text-lg font-bold mb-2">Dark CTA Card</h3>
                                <p className="text-sm text-primary-foreground/70">bg-gradient-to-br from-primary to-scrim</p>
                            </div>
                        </div>

                        <div className="mt-12">
                            <SubHeading
                                label="Stat cards"
                                description="The admin dashboard tile. Direction is carried by an arrow and a word as well as colour, so the trend survives a greyscale print and a red-green colour deficiency."
                            />
                            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                                {[
                                    { label: 'Monthly revenue', value: '$48,290', delta: '+12.4%', up: true, icon: CreditCard },
                                    { label: 'Active tenants', value: '1,284', delta: '+3.1%', up: true, icon: Boxes },
                                    { label: 'Open tickets', value: '17', delta: '-8.0%', up: false, icon: Inbox },
                                    { label: 'New customers', value: '96', delta: '+21.7%', up: true, icon: Users },
                                ].map((stat) => (
                                    <div key={stat.label} className="rounded-xl border border-border bg-card p-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                                            <stat.icon className="size-4 shrink-0 text-muted-foreground/50" />
                                        </div>
                                        <p className="mt-3 text-2xl font-bold tabular-nums text-foreground">{stat.value}</p>
                                        <p className={cn(
                                            'mt-1.5 flex items-center gap-1 text-xs font-medium',
                                            stat.up ? 'text-success' : 'text-destructive',
                                        )}>
                                            {stat.up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                                            {stat.delta}
                                            <span className="font-normal text-muted-foreground">vs last month</span>
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-12 grid gap-6 lg:grid-cols-3">
                            <div>
                                <SubHeading label="List card" />
                                <div className="overflow-hidden rounded-xl border border-border bg-card">
                                    <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
                                        <h4 className="text-sm font-semibold text-foreground">Recent signups</h4>
                                        <Button variant="ghost" size="sm" className="text-muted-foreground">View all</Button>
                                    </div>
                                    <div className="divide-y divide-border/60">
                                        {demoRows.slice(0, 3).map((row) => (
                                            <div key={row.id} className="flex items-center gap-3 px-5 py-3">
                                                <AvatarInitials name={row.name} className="size-8 text-xs" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                                                    <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                                                </div>
                                                <Badge variant="neutral">{row.plan}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <SubHeading label="Selectable card" description="The plan picker. Selection is a border and a tick, not colour alone." />
                                <div className="space-y-3">
                                    <div className="relative rounded-xl border-2 border-primary bg-accent/40 p-5">
                                        <CircleCheck className="absolute right-4 top-4 size-5 text-primary" />
                                        <p className="text-sm font-semibold text-foreground">Scale</p>
                                        <p className="mt-1 text-xs text-muted-foreground">Up to 25 users · $49/mo</p>
                                    </div>
                                    <div className="rounded-xl border-2 border-border p-5 hover:border-input">
                                        <p className="text-sm font-semibold text-foreground">Launch</p>
                                        <p className="mt-1 text-xs text-muted-foreground">Up to 5 users · $19/mo</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <SubHeading label="Summary card" description="Key–value pairs on a detail page." />
                                <div className="rounded-xl border border-border bg-card p-5">
                                    <h4 className="text-sm font-semibold text-foreground">Subscription</h4>
                                    <dl className="mt-4 space-y-3 text-sm">
                                        {[
                                            ['Status', <Badge key="s" variant="success" dot>Active</Badge>],
                                            ['Plan', 'Scale — $49/mo'],
                                            ['Renews', 'Oct 1, 2026'],
                                            ['Seats', '18 of 25'],
                                        ].map(([term, value]) => (
                                            <div key={String(term)} className="flex items-center justify-between gap-4">
                                                <dt className="text-muted-foreground">{term}</dt>
                                                <dd className="font-medium text-foreground">{value}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* SECTIONS */}
                    <section>
                        <SectionHeading
                            id="sections"
                            title="Sections & Page Shells"
                            source="components/admin/page-header.tsx · app/admin/(dashboard)/layout.tsx"
                            description="The frames a page is assembled from — the rhythm above and between the components, which is what makes two pages look like the same product."
                        />

                        <SubHeading label="Admin page header" description="Title, supporting line, and the primary action pinned right. Every admin list and detail page opens with this." />
                        <div className="mb-10 rounded-xl border border-border bg-card p-6">
                            <AdminPageHeader
                                title="Plans"
                                subtitle="12 plans across 2 products"
                                action={{ label: 'New plan', href: '#sections' }}
                            >
                                {/* The children slot: secondary controls sit left of the CTA. */}
                                <Button variant="outline"><Download /> Export</Button>
                            </AdminPageHeader>
                        </div>

                        <SubHeading label="Form section" description="A heading, an optional explanatory line, and a rule above. The first section drops the rule, so a form never opens with a stray border." />
                        <div className="mb-10 max-w-2xl space-y-7 rounded-xl border border-border bg-card p-6 md:p-8">
                            <section className="space-y-5">
                                <div>
                                    <h2 className="text-sm font-semibold text-foreground">Identity</h2>
                                    <p className="mt-1 text-xs text-muted-foreground">What this account is called and who it sends as.</p>
                                </div>
                                <div className="grid gap-6 md:grid-cols-2">
                                    <div>
                                        <Label className="mb-1.5 text-sm text-foreground/80">Label</Label>
                                        <Input defaultValue="Support" />
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 text-sm text-foreground/80">Email address</Label>
                                        <Input defaultValue="support@unityalgo.com" />
                                    </div>
                                </div>
                            </section>
                            <section className="space-y-5 border-t border-border pt-7">
                                <div>
                                    <h2 className="text-sm font-semibold text-foreground">Outgoing mail</h2>
                                    <p className="mt-1 text-xs text-muted-foreground">Required. This is what sends mail.</p>
                                </div>
                                <div className="grid gap-6 md:grid-cols-3">
                                    <div className="md:col-span-2">
                                        <Label className="mb-1.5 text-sm text-foreground/80">Host</Label>
                                        <Input defaultValue="smtp.gmail.com" />
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 text-sm text-foreground/80">Port</Label>
                                        <SmartInput name="tp-section-port" kind="integer" min={1} max={65535} defaultValue="587" />
                                    </div>
                                </div>
                            </section>
                        </div>

                        <SubHeading label="Marketing section rhythm" description="An eyebrow badge, a heading, a supporting paragraph capped near 65 characters, then the content. The width cap is the point — a full-bleed paragraph is measurably harder to read." />
                        <div className="rounded-xl border border-border/60 bg-muted px-6 py-14 text-center">
                            <Badge variant="brand" className="mb-4">Why UnityAlgo</Badge>
                            <h2 className="mx-auto max-w-2xl text-3xl font-bold text-foreground md:text-4xl">
                                Software that fits how your business already works
                            </h2>
                            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-foreground/70">
                                One heading, one supporting paragraph, one action. Anything more competes with the section that follows it.
                            </p>
                            <div className="mt-7 flex flex-wrap justify-center gap-3">
                                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">Get started <ArrowRight /></Button>
                                <Button size="lg" variant="outline">Talk to us</Button>
                            </div>
                        </div>
                    </section>

                    {/* TABS */}
                    <section>
                        <SectionHeading
                            id="tabs"
                            title="Tabs"
                            source="components/ui/tabs.tsx"
                            description="Switches between panels within one screen. Used for the cover-image field (URL vs upload) and the customer portal's settings groups."
                        />
                        <Spec surface="panel">
                            <Tabs defaultValue="overview">
                                <TabsList>
                                    <TabsTrigger value="overview">Overview</TabsTrigger>
                                    <TabsTrigger value="activity">Activity</TabsTrigger>
                                    <TabsTrigger value="settings">Settings</TabsTrigger>
                                </TabsList>
                                <TabsContent value="overview" className="pt-4 text-sm text-foreground/70">
                                    The selected panel. Only one is mounted at a time.
                                </TabsContent>
                                <TabsContent value="activity" className="pt-4 text-sm text-foreground/70">
                                    Tab state lives in the component; nothing is written to the URL.
                                </TabsContent>
                                <TabsContent value="settings" className="pt-4 text-sm text-foreground/70">
                                    For state that should survive a refresh or be linkable, use routes instead.
                                </TabsContent>
                            </Tabs>
                        </Spec>

                        <div className="mt-8">
                            <SubHeading
                                label="Filter pills"
                                description="The admin list views' one-of-N filter. A radiogroup, not buttons, so arrow keys move between options."
                            />
                            <Spec surface="panel">
                                <FilterPillsDemo />
                            </Spec>
                        </div>

                        <div className="mt-8">
                            <SubHeading label="Breadcrumb" description="components/ui/breadcrumb.tsx — trail for nested admin records." />
                            <Spec surface="panel">
                                <Breadcrumb>
                                    <BreadcrumbList>
                                        <BreadcrumbItem>
                                            <BreadcrumbLink href="#tabs">Admin</BreadcrumbLink>
                                        </BreadcrumbItem>
                                        <BreadcrumbSeparator />
                                        <BreadcrumbItem>
                                            <BreadcrumbLink href="#tabs">Tenants</BreadcrumbLink>
                                        </BreadcrumbItem>
                                        <BreadcrumbSeparator />
                                        <BreadcrumbItem>
                                            <BreadcrumbPage>north-and-co</BreadcrumbPage>
                                        </BreadcrumbItem>
                                    </BreadcrumbList>
                                </Breadcrumb>
                            </Spec>
                        </div>
                    </section>

                    {/* TOOLTIP & SKELETON */}
                    <section>
                        <SectionHeading
                            id="feedback"
                            title="Tooltip & Skeleton"
                            source="components/ui/tooltip.tsx · skeleton.tsx"
                            description="The two components that stand in for information: one on demand, one while it loads."
                        />
                        <div className="grid gap-8 md:grid-cols-2">
                            <Spec
                                label="Tooltip"
                                hint="hover or focus the trigger"
                                surface="panel"
                            >
                                <TooltipProvider>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="outline" size="sm">Hover me</Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Deploys the container to its worker node</TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" aria-label="More information">
                                                    <Info className="size-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Icon-only controls need a tooltip and an aria-label</TooltipContent>
                                        </Tooltip>
                                    </div>
                                </TooltipProvider>
                            </Spec>

                            <Spec
                                label="Skeleton"
                                hint="shape of the content, not a spinner"
                                surface="panel"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="size-10 rounded-full" />
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-3.5 w-2/5" />
                                            <Skeleton className="h-3 w-3/5" />
                                        </div>
                                    </div>
                                    <Skeleton className="h-3 w-full" />
                                    <Skeleton className="h-3 w-4/5" />
                                </div>
                            </Spec>
                        </div>

                        <div className="mt-8">
                            <SubHeading
                                label="Separator & avatar"
                                description="components/ui/separator.tsx and components/admin/avatar-initials.tsx — the initials avatar derives its colour from the name, so the same person is the same colour everywhere."
                            />
                            <Spec surface="panel">
                                <div className="flex flex-wrap items-center gap-3">
                                    {['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Katherine Johnson'].map((name) => (
                                        <div key={name} className="flex items-center gap-2">
                                            <AvatarInitials name={name} />
                                            <span className="text-sm text-foreground/70">{name}</span>
                                        </div>
                                    ))}
                                </div>
                                <Separator className="my-5" />
                                <div className="flex h-5 items-center gap-3 text-sm text-muted-foreground">
                                    <span>Horizontal above</span>
                                    <Separator orientation="vertical" />
                                    <span>vertical between</span>
                                </div>
                            </Spec>
                        </div>
                    </section>

                    {/* ADMIN LIST VIEW */}
                    <section>
                        <SectionHeading
                            id="listview"
                            title="List View"
                            source="components/admin/list-view.tsx"
                            description="The component behind every /admin list. Pages supply rows and column definitions; sorting, resizing, quick search, pagination and the empty state are handled for them. Built on AG Grid Community, themed from the ink tokens."
                        />

                        <Spec
                            label="Live grid"
                            hint="sort a column, search, or change the page size"
                        >
                            <ListViewDemo />
                        </Spec>

                        <div className="mt-8 grid gap-8 md:grid-cols-2">
                            <div>
                                <SubHeading
                                    label="Cell renderers"
                                    description="components/admin/grid-cells.tsx — a column names the renderer it wants instead of repeating markup."
                                />
                                <div className="rounded-xl border border-border bg-card divide-y divide-border/60 text-sm">
                                    {[
                                        ['StackedCell', 'Title over a dimmer subtitle, optionally linked'],
                                        ['AvatarCell', 'Same, led by the initials avatar'],
                                        ['MutedCell', 'One line of secondary text, truncated'],
                                        ['ClampedCell', 'Multi-line text clamped to two lines'],
                                        ['BadgeCell', 'One or two status badges'],
                                        ['ActionsCell', 'Trailing badge, links, form submits, delete'],
                                    ].map(([name, what]) => (
                                        <div key={name} className="flex flex-wrap items-baseline gap-x-3 px-4 py-2.5">
                                            <code className="font-mono text-xs text-foreground">{name}</code>
                                            <span className="text-xs text-muted-foreground">{what}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <SubHeading
                                    label="Why sorting and rendering are separate"
                                    description="The one rule to know before adding a column."
                                />
                                <div className="rounded-xl border border-border bg-card p-5 text-sm leading-relaxed text-foreground/70">
                                    <p>
                                        A column supplies <CodeLabel>text</CodeLabel> for what it sorts and searches by,
                                        and <CodeLabel>get</CodeLabel> for the object the renderer draws. Keeping them
                                        apart is what lets a Name column search on the plain name while rendering an
                                        avatar, a link and a subtitle — sorting a React element would not work.
                                    </p>
                                    <pre className="mt-4 overflow-x-auto rounded-lg bg-primary p-4 text-small leading-relaxed text-primary-foreground/90">
{`renderedColumn<Row, StackedValue>({
  headerName: 'Customer',
  icon: <Mail />,
  cellRenderer: StackedCell,
  text: (row) => row.name,
  get:  (row) => ({
    primary: row.name,
    secondary: row.email,
    href: \`/admin/users/\${row.id}\`,
  }),
})`}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* TABLES */}
                    <section>
                        <SectionHeading
                            id="tables"
                            title="Tables & Pagination"
                            description="The static table treatment — header on muted, rows divided by border, actions right-aligned. The admin list views themselves now render through components/admin/list-view.tsx (AG Grid), which reuses these same tokens."
                        />
                        <div className="bg-card border border-border/60 rounded-xl overflow-hidden mb-6">
                            <table className="w-full text-sm">
                                <thead className="bg-muted text-left text-muted-foreground uppercase text-xs tracking-wide">
                                    <tr>
                                        <th className="px-6 py-4">Title</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Updated</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {[
                                        { title: 'Finance Transformation', status: 'Published' },
                                        { title: 'Choosing a Modern POS', status: 'Draft' },
                                    ].map((row) => (
                                        <tr key={row.title}>
                                            <td className="px-6 py-4 font-medium text-foreground">{row.title}</td>
                                            <td className="px-6 py-4">
                                                <Badge variant={row.status === 'Published' ? 'success' : 'neutral'}>
                                                    {row.status}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground">Jul 22, 2026</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button size="sm" variant="outline" >Edit</Button>
                                                    <Button size="sm" variant="destructive" >Delete</Button>
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
                        {}
                        <div className="p-6 rounded-xl border border-border/60 bg-muted mb-6 overflow-x-auto">
                            <nav className="inline-flex items-center gap-1 bg-card/80 backdrop-blur-md px-2 py-1.5 rounded-lg border border-primary-foreground/20 shadow-sm">
                                {['Home', 'Services', 'About Us', 'Blog', 'Contact'].map((item, i) => (
                                    <button
                                        key={item}
                                        className={cn(
                                            'relative px-5 py-2 text-sm font-medium rounded-md transition-colors',
                                            i === 0 ? 'bg-border/50 text-foreground' : 'text-foreground/70 hover:bg-secondary'
                                        )}
                                    >
                                        {item}
                                    </button>
                                ))}
                            </nav>
                        </div>
                        <div className="rounded-xl border border-border/60 overflow-hidden max-w-xs">
                            <aside className="w-full bg-card">
                                <div className="px-4 py-3 border-b border-border/60 font-bold text-sm">Admin</div>
                                <nav className="p-2 space-y-1">
                                    {['Blogs', 'Users', 'Contacts'].map((item, i) => (
                                        <div
                                            key={item}
                                            className={cn(
                                                'px-3 py-2 rounded-md text-sm font-medium',
                                                i === 0 ? 'bg-accent text-primary' : 'text-foreground/70'
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
                        <SectionHeading id="accordion" title="Accordion" source="components/ui/accordion.tsx" description="components/ui/accordion.tsx — used for FAQs and the module-page overview sidebar." />
                        <div className="max-w-2xl bg-card rounded-xl border border-border/60 px-4">
                            <Accordion type="single" collapsible defaultValue="item-0">
                                {faqItems.map((item, idx) => (
                                    <AccordionItem key={idx} value={`item-${idx}`}>
                                        <AccordionTrigger className="text-base text-foreground">{item.question}</AccordionTrigger>
                                        <AccordionContent className="text-foreground/70 leading-relaxed">{item.answer}</AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </div>
                    </section>

                    {/* OVERLAYS */}
                    <section>
                        <SectionHeading
                            id="overlays"
                            title="Modals, Sheets & Popovers"
                            source="components/ui/dialog.tsx · sheet.tsx · popover.tsx · alert-dialog.tsx"
                            description="Four layered surfaces, each for a different weight of interruption: a popover for a hint, a sheet for a side panel, a dialog for a task, an alert dialog for a decision that cannot be undone."
                        />
                        <div className="flex flex-wrap gap-4">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" >Open Popover</Button>
                                </PopoverTrigger>
                                <PopoverContent>
                                    <p className="text-sm text-foreground/70 px-2 py-1">Popover content — bg-popover, shadow-md, border-border.</p>
                                </PopoverContent>
                            </Popover>

                            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Open Dialog</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Confirm action</DialogTitle>
                                        <DialogDescription>This is the Dialog primitive used for confirmations across the admin panel.</DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button variant="outline" >Cancel</Button>
                                        </DialogClose>
                                        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Confirm</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            <Sheet>
                                <SheetTrigger asChild>
                                    <Button variant="outline">Open Sheet</Button>
                                </SheetTrigger>
                                <SheetContent>
                                    <SheetHeader>
                                        <SheetTitle>Side panel</SheetTitle>
                                        <SheetDescription>
                                            Slides in from the edge. Used for the mobile navigation and for detail
                                            panels that should not take the reader off the list.
                                        </SheetDescription>
                                    </SheetHeader>
                                </SheetContent>
                            </Sheet>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive">Open Alert Dialog</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete this tenant?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Reserved for irreversible actions. The confirm button carries the
                                            destructive variant, and the cancel button is the one focused by default.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction asChild>
                                            <Button variant="destructive">Delete</Button>
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>

                        <div className="mt-6 rounded-xl border border-border/60 bg-muted p-5">
                            <p className="text-sm leading-relaxed text-foreground/70">
                                <span className="font-semibold text-foreground">Choosing between them.</span>{' '}
                                Popover for a hint that needs no decision · Sheet when the underlying list must stay
                                in view · Dialog for a self-contained task · Alert dialog only when the action
                                destroys something.
                            </p>
                        </div>
                    </section>

                    {/* EMPTY & ERROR STATES */}
                    <section>
                        <SectionHeading
                            id="states"
                            title="Empty & Error States"
                            source="components/admin/list-view.tsx · page-header.tsx · controller-offline.tsx"
                            description="What a screen shows when there is nothing to show, or when the thing behind it is down. These are as much a part of the system as the populated states."
                        />

                        <div className="space-y-8">
                            <Spec label="Page header" hint="title, count, primary action — every admin list opens with it">
                                <div className="rounded-xl border border-border bg-card px-5 pt-5">
                                    <AdminPageHeader
                                        title="Tenants"
                                        subtitle="24 storefronts"
                                        action={{ label: 'New Tenant', href: '#states' }}
                                    />
                                </div>
                            </Spec>

                            <div className="grid gap-8 md:grid-cols-2">
                                <Spec label="Inline error" hint="a failed action, reported above the list">
                                    <AdminPageError message="Tenant still has a running container; terminate it first." />
                                </Spec>
                                <Spec label="Inline notice" hint="a succeeded action">
                                    <AdminPageNotice message="Connection test succeeded." />
                                </Spec>
                            </div>

                            <Spec
                                label="Empty state"
                                hint="says what would be here and how to create the first one"
                            >
                                <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-input bg-card p-6 text-center">
                                    <Boxes className="h-10 w-10 text-muted-foreground/50" />
                                    <h3 className="mt-4 text-lg font-bold text-foreground">No tenants yet</h3>
                                    <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                                        Creating a tenant reserves its slug and database. Provisioning it deploys the
                                        container.
                                    </p>
                                    <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90"><Link href="#states" className="mt-5">New tenant</Link></Button>
                                </div>
                            </Spec>

                            <Spec
                                label="No search results"
                                hint="distinct from empty — the list has rows, this filter does not"
                            >
                                <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-border bg-card p-6 text-center">
                                    <Inbox className="h-8 w-8 text-muted-foreground/50" />
                                    <p className="mt-3 text-sm text-muted-foreground">No matches for that search.</p>
                                </div>
                            </Spec>

                            <Spec
                                label="Dependency offline"
                                hint="the controller API is unreachable — shown instead of a crash"
                            >
                                <ControllerOffline message="Could not reach the controller at http://localhost:8000." />
                            </Spec>
                        </div>
                    </section>

                    {/* BORDERS & RADIUS */}
                    <section>
                        <SectionHeading
                            id="borders"
                            title="Borders & Radius"
                            source="app/globals.css — --radius"
                            description="Every step derives from a single --radius token, so retuning the whole site’s roundness is a one-line change. rounded-md is the Button default."
                        />
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                            {[
                                { label: 'rounded', cls: 'rounded' },
                                { label: 'rounded-md', cls: 'rounded-md' },
                                { label: 'rounded-lg', cls: 'rounded-lg' },
                                { label: 'rounded-xl', cls: 'rounded-xl' },
                                { label: 'rounded-2xl', cls: 'rounded-2xl' },
                                { label: 'rounded-full', cls: 'rounded-full' },
                            ].map((r) => (
                                <div key={r.label} className="flex flex-col items-center gap-2">
                                    <div className={cn('w-16 h-16 bg-accent border-2 border-primary', r.cls)} />
                                    <span className="text-xs font-mono text-muted-foreground">{r.label}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* SHADOWS */}
                    <section>
                        <SectionHeading
                            id="shadows"
                            title="Shadows"
                            source="app/globals.css — --shadow-*"
                            description="One neutral elevation scale, defined once in globals.css and tinted from the foreground token rather than from an accent. A coloured shadow reads as a glow, which competes with the status colours; the scale stays achromatic so elevation only ever communicates height."
                        />
                        {}
                        <div className="rounded-xl border border-border/60 bg-muted px-6 py-8">
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-x-4 gap-y-8">
                                {[
                                    { label: 'shadow-sm', cls: 'shadow-sm', tile: 'bg-card' },
                                    { label: 'shadow-md', cls: 'shadow-md', tile: 'bg-card' },
                                    { label: 'shadow-lg', cls: 'shadow-lg', tile: 'bg-card' },
                                    { label: 'shadow-xl', cls: 'shadow-xl', tile: 'bg-card' },
                                    { label: 'shadow-2xl', cls: 'shadow-2xl', tile: 'bg-card' },
                                    { label: 'shadow-xs', cls: 'shadow-xs', tile: 'bg-card' },
                                    { label: 'shadow-foreground/5', cls: 'shadow-xl shadow-foreground/5', tile: 'bg-card' },
                                ].map((s) => (
                                    <div key={s.label} className="flex flex-col items-center gap-3">
                                        <div className={cn('w-16 h-16 rounded-lg', s.tile, s.cls)} />
                                        <span className="text-small font-mono text-muted-foreground text-center">{s.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* SPACING */}
                    <section>
                        <SectionHeading id="spacing" title="Spacing Scale" description="Common gap/padding values used for card and section rhythm." />
                        {}
                        <div className="max-w-xl rounded-xl border border-border/60 bg-card divide-y divide-border/60">
                            {[1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24].map((n) => (
                                <div key={n} className="flex items-center gap-4 px-5 py-2.5">
                                    <span className="w-12 shrink-0 text-xs font-mono text-foreground/80 tabular-nums">{n}</span>
                                    <span className="w-14 shrink-0 text-xs font-mono text-muted-foreground tabular-nums">{n * 4}px</span>
                                    <div className="h-3 bg-primary rounded-sm" style={{ width: `${n * 4}px` }} />
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* SURFACES */}
                    <section>
                        <SectionHeading
                            id="surfaces"
                            title="Surfaces & Background Colors"
                            source="app/globals.css"
                            description="The flat fills a component can sit on, and what belongs on each. These are semantic tokens, not raw values: anything using bg-muted follows if --muted changes."
                        />

                        <SubHeading label="Page and panel surfaces" description="Each swatch shows body text and a muted line on that fill, so contrast can be judged rather than assumed." />
                        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {[
                                { token: 'bg-background', hex: '--background', use: 'The page itself.', cls: 'bg-background border-border', text: 'text-foreground', muted: 'text-muted-foreground' },
                                { token: 'bg-card', hex: '--card', use: 'Cards, panels and popovers.', cls: 'bg-card border-border', text: 'text-foreground', muted: 'text-muted-foreground' },
                                { token: 'bg-muted', hex: '--muted', use: 'Table headers, inset wells, read-only rows.', cls: 'bg-muted border-border', text: 'text-foreground', muted: 'text-muted-foreground' },
                                { token: 'bg-secondary', hex: '--secondary', use: 'Hover on a menu item or list row.', cls: 'bg-secondary border-border', text: 'text-foreground', muted: 'text-muted-foreground' },
                                { token: 'bg-accent', hex: '--accent', use: 'Active sidebar item, icon tiles, soft emphasis.', cls: 'bg-accent border-border', text: 'text-foreground', muted: 'text-muted-foreground' },
                                { token: 'bg-primary', hex: '--primary', use: 'Primary buttons and dark call-to-action panels.', cls: 'bg-primary border-foreground', text: 'text-primary-foreground', muted: 'text-primary-foreground/60' },
                            ].map((surface) => (
                                <div key={surface.token} className={cn('rounded-xl border p-5', surface.cls)}>
                                    <p className={cn('font-mono text-xs', surface.text)}>{surface.token}</p>
                                    <p className={cn('mt-1 font-mono text-small', surface.muted)}>{surface.hex}</p>
                                    <p className={cn('mt-3 text-sm leading-relaxed', surface.muted)}>{surface.use}</p>
                                </div>
                            ))}
                        </div>

                        <SubHeading label="Status surfaces" description="Every banner, badge background and inline message pairs a tint of the status token with the token itself as text." />
                        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {[
                                { name: 'Success', fill: 'bg-success/10', ink: 'text-success', border: 'border-success/20', body: 'Saved. Changes are live.' },
                                { name: 'Warning', fill: 'bg-warning/10', ink: 'text-warning', border: 'border-warning/20', body: 'This plan has no Paddle price.' },
                                { name: 'Error', fill: 'bg-destructive/10', ink: 'text-destructive', border: 'border-destructive/20', body: 'That email is already registered.' },
                                { name: 'Info', fill: 'bg-primary/10', ink: 'text-primary', border: 'border-primary/20', body: 'Provisioning can take a few minutes.' },
                            ].map((tone) => (
                                <div key={tone.name} className={cn('rounded-xl border p-5', tone.fill, tone.border)}>
                                    <p className={cn('text-xs font-semibold uppercase tracking-wider', tone.ink)}>{tone.name}</p>
                                    <p className={cn('mt-2 text-sm leading-relaxed', tone.ink)}>{tone.body}</p>
                                    <p className={cn('mt-3 font-mono text-small opacity-60', tone.ink)}>{tone.fill} · {tone.ink}</p>
                                </div>
                            ))}
                        </div>

                        <SubHeading label="On dark" description="What stays legible once the surface inverts. Body text drops to white/70 rather than a grey, so it dims with the background instead of fighting it." />
                        <div className="rounded-2xl bg-primary p-8">
                            <div className="flex flex-wrap items-center gap-3">
                                <Button className="bg-card text-foreground hover:bg-secondary">Primary</Button>
                                <Button variant="outline" className="border-primary-foreground/25 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">Outline</Button>
                                <Button variant="ghost" className="text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground">Ghost</Button>
                                <Badge variant="success" dot>Live</Badge>
                                <span className="rounded border border-primary-foreground/20 px-2.5 py-1 text-xs text-primary-foreground/70">border-primary-foreground/20</span>
                            </div>
                            <p className="mt-6 max-w-md text-sm leading-relaxed text-primary-foreground/70">
                                Supporting copy on a dark panel — text-primary-foreground/70. Headings stay full white; anything below 60% opacity fails contrast at body sizes.
                            </p>
                            <div className="mt-6 grid gap-3 sm:grid-cols-3">
                                {['bg-primary-foreground/5', 'bg-primary-foreground/10', 'bg-card/[0.02]'].map((fill) => (
                                    <div key={fill} className={cn('rounded-lg border border-primary-foreground/10 p-4', fill)}>
                                        <span className="font-mono text-small text-primary-foreground/60">{fill}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* BACKGROUNDS */}
                    <section>
                        <SectionHeading id="backgrounds" title="Decorative Backgrounds" description="Decorative surfaces layered behind hero and CTA sections." />
                        <div className="grid sm:grid-cols-2 gap-6">
                            <div className="relative h-32 rounded-xl overflow-hidden border border-border/60">
                                <div className="absolute inset-0 bg-grid-pattern mask-[radial-gradient(ellipse_at_center,var(--scrim)_30%,transparent_70%)] opacity-40" />
                                <span className="absolute bottom-3 left-3 text-xs font-mono text-muted-foreground">.bg-grid-pattern</span>
                            </div>
                            <div className="relative h-32 rounded-xl overflow-hidden glass border border-primary-foreground/20">
                                <span className="absolute bottom-3 left-3 text-xs font-mono text-muted-foreground">.glass</span>
                            </div>
                            <div className="relative h-32 rounded-xl overflow-hidden bg-gradient-to-br from-primary to-scrim">
                                <span className="absolute bottom-3 left-3 text-xs font-mono text-primary-foreground/60">from-primary to-scrim</span>
                            </div>
                            <div className="relative h-32 rounded-xl overflow-hidden bg-primary">
                                <span className="absolute bottom-3 left-3 text-xs font-mono text-primary-foreground/80">bg-primary (solid, no scale)</span>
                            </div>
                            <div className="relative h-32 rounded-xl overflow-hidden bg-primary">
                                <div className="absolute inset-0 bg-gradient-to-r from-scrim/85 via-scrim/70 to-scrim/40" />
                                <span className="absolute bottom-3 left-3 text-xs font-mono text-primary-foreground/60">image overlay gradient</span>
                            </div>
                            <div className="relative h-32 rounded-xl overflow-hidden bg-accent flex items-center justify-center">
                                <div className="w-16 h-16 bg-primary/20 rounded-full blur-2xl animate-blob" />
                                <span className="absolute bottom-3 left-3 text-xs font-mono text-muted-foreground">.animate-blob</span>
                            </div>
                        </div>
                    </section>

                    {/* ICONS */}
                    <section>
                        <SectionHeading id="icons" title="Icons" description="lucide-react — the icon set used site-wide. A representative sample." />
                        <div className="grid grid-cols-4 sm:grid-cols-8 gap-4">
                            {[Rocket, ArrowRight, ShieldCheck, Zap, Layers, BrainCircuit, CheckCircle2, Check, Info, AlertTriangle, XCircle, Facebook, Linkedin, ChevronDown, Search, Upload, LinkIcon, TableIcon].map((Icon, i) => (
                                <div key={i} className="flex items-center justify-center h-14 rounded-lg border border-border/60 text-primary">
                                    <Icon className="w-5 h-5" />
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* COMPOSED COMPONENTS */}
                    <section>
                        <SectionHeading id="components" title="Composed Components" description="Full site sections, rendered live with sample data, exactly as they appear on real pages." />

                        <div className="space-y-16">
                            <div className="rounded-xl overflow-hidden border border-border/60">
                                <div className="px-6 py-3 bg-muted text-xs font-semibold text-muted-foreground uppercase tracking-wide">FaqSection</div>
                                <FaqSection items={faqItems} />
                            </div>

                            <div className="rounded-xl overflow-hidden border border-border/60">
                                <div className="px-6 py-3 bg-muted text-xs font-semibold text-muted-foreground uppercase tracking-wide">PricingTable</div>
                                <PricingTable plans={pricingPlans} />
                            </div>

                            <div className="rounded-xl overflow-hidden border border-border/60">
                                <div className="px-6 py-3 bg-muted text-xs font-semibold text-muted-foreground uppercase tracking-wide">ProjectFlow</div>
                                <ProjectFlow stages={flowStages} />
                            </div>

                            <div className="rounded-xl overflow-hidden border border-border/60">
                                <div className="px-6 py-3 bg-muted text-xs font-semibold text-muted-foreground uppercase tracking-wide">FeaturesGrid</div>
                                <FeaturesGrid features={['Financial Management', 'Accounts Receivable', 'Asset Management', 'Cash & Banking', 'Reporting & Analytics', 'Budgeting', 'Tax & Compliance', 'Automation']} />
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {/* FOOTER */}
            <section id="footer" className="scroll-mt-24 mt-24">
                <div className="site-container site-gutters mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground">Footer</h2>
                    <p className="text-muted-foreground mt-2">The live Footer component, rendered as-is.</p>
                </div>
                <Footer />
            </section>
        </div>
    );
}
