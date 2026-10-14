'use client';

import { useState, type ReactNode } from 'react';
import {
    Check,
    ChevronLeft,
    ChevronRight,
    Copy,
    Download,
    Globe,
    Loader2,
    MoreHorizontal,
    Plus,
    X,
} from 'lucide-react';
import { PortalPanel } from '@/components/customer/portal-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormField, fieldAria } from '@/components/ui/form-field';
import { SmartInput } from '@/components/ui/smart-input';
import { Autocomplete } from '@/components/ui/autocomplete';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from '@/components/ui/input-otp';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Notice } from '@/components/ui/notice';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionContent,
} from '@/components/ui/accordion';
import {
    Table,
    TableHeader,
    TableHead,
    TableRow,
    TableBody,
    TableCell,
    TableCaption,
} from '@/components/ui/table';
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogClose,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogTrigger,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
    AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from '@/components/ui/popover';
import {
    Sheet,
    SheetTrigger,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
} from '@/components/ui/tooltip';
import {
    DropdownMenu,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbSeparator,
    BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import {
    NavigationMenu,
    NavigationMenuList,
    NavigationMenuItem,
    NavigationMenuTrigger,
    NavigationMenuContent,
    NavigationMenuLink,
} from '@/components/ui/navigation-menu';
import { Skeleton } from '@/components/ui/skeleton';

const sections = [
    {
        id: 'foundations',
        title: 'Foundations',
        search: 'colors tokens typography spacing radius density fonts',
    },
    {
        id: 'buttons',
        title: 'Buttons & actions',
        search: 'button primary secondary outline ghost link destructive icon loading disabled',
    },
    {
        id: 'fields',
        title: 'Fields & validation',
        search: 'input password label textarea formfield smartinput autocomplete currency otp select',
    },
    {
        id: 'choices',
        title: 'Choices & preferences',
        search: 'checkbox switch radio toggles',
    },
    {
        id: 'surfaces',
        title: 'Panels & feedback',
        search: 'card portalpanel badge notice alert status success error empty',
    },
    {
        id: 'navigation',
        title: 'Navigation & disclosure',
        search: 'tabs accordion breadcrumb separator sidebar navigationmenu',
    },
    {
        id: 'tables',
        title: 'Tables & lists',
        search: 'table pagination data sort filter',
    },
    {
        id: 'overlays',
        title: 'Dialogs & menus',
        search: 'dialog alertdialog sheet popover tooltip dropdownmenu overlay',
    },
    {
        id: 'loading',
        title: 'Loading & empty states',
        search: 'skeleton progress spinner empty',
    },
];

function Example({
    title,
    description,
    source,
    code,
    children,
}: {
    title: string;
    description: string;
    source: string;
    code: string;
    children: ReactNode;
}) {
    return (
        <div className="min-w-0 rounded-lg border border-ink-200 bg-white">
            <div className="border-b border-ink-200 px-4 py-4">
                <h3 className="portal-text-body font-semibold">{title}</h3>
                <p className="mt-1 portal-text-caption leading-5 text-ink-600">
                    {description}
                </p>
            </div>
            <div className="p-4">{children}</div>
            <details className="border-t border-ink-200 portal-text-caption">
                <summary className="cursor-pointer px-4 py-3 font-medium text-ink-600">
                    Source & usage
                </summary>
                <p className="break-all px-4 pb-3 text-ink-500">{source}</p>
                <pre className="overflow-x-auto border-t border-ink-200 bg-ink-50 p-4 leading-6">
                    <code>{code}</code>
                </pre>
            </details>
        </div>
    );
}

function Section({ id, children }: { id: string; children: ReactNode }) {
    const section = sections.find((item) => item.id === id)!;
    return (
        <section id={id} className="scroll-mt-24 portal-fields">
            <div>
                <p className="portal-text-caption font-medium text-ink-500">
                    {String(sections.indexOf(section) + 1).padStart(2, '0')}
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">
                    {section.title}
                </h2>
            </div>
            {children}
        </section>
    );
}

export function ComponentLibrary() {
    const [query, setQuery] = useState('');
    const [notice, setNotice] = useState('');
    const [switchOn, setSwitchOn] = useState(true);
    const [density, setDensity] = useState('1');
    const [height, setHeight] = useState('32');
    const [rowsQuery, setRowsQuery] = useState('');
    const visible = sections.filter((section) =>
        `${section.title} ${section.search}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
    );
    const shown = (id: string) => visible.some((section) => section.id === id);
    const rows = [
        {
            name: 'Main workspace',
            app: 'ERPNext',
            status: 'Ready',
            tone: 'success' as const,
        },
        {
            name: 'Retail workspace',
            app: 'Point of Sale',
            status: 'Installing',
            tone: 'info' as const,
        },
        {
            name: 'Test workspace',
            app: 'Lending',
            status: 'Needs attention',
            tone: 'warning' as const,
        },
    ].filter((row) =>
        `${row.name} ${row.app}`
            .toLowerCase()
            .includes(rowsQuery.toLowerCase()),
    );

    return (
        <div className="mx-auto portal-page">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">
                            Dashboard
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Components</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>
            <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <p className="portal-text-caption font-medium uppercase tracking-wider text-ink-500">
                        Customer portal / Design system
                    </p>
                    <h1 className="portal-page-title mt-2">
                        One library. Every screen.
                    </h1>
                    <p className="mt-3 portal-form portal-text-body leading-6 text-ink-600">
                        Explore the components used in your portal. Change the
                        shared component or its theme token once, and every
                        screen using it follows.
                    </p>
                </div>
                <Badge variant="neutral" dot={false}>
                    Live component reference
                </Badge>
            </div>
            <PortalPanel className="mt-7">
                <div className="grid gap-5 md:grid-cols-3">
                    <div>
                        <h2 className="portal-text-body font-semibold">
                            01 / Theme values
                        </h2>
                        <p className="mt-2 portal-text-caption leading-6 text-ink-600">
                            Colors, control sizing, label sizes and panel
                            spacing.
                        </p>
                        <code className="mt-2 block break-all portal-text-caption text-link">
                            app/dashboard/portal.css
                        </code>
                    </div>
                    <div>
                        <h2 className="portal-text-body font-semibold">
                            02 / Shared components
                        </h2>
                        <p className="mt-2 portal-text-caption leading-6 text-ink-600">
                            Markup, variants, interaction and accessibility.
                        </p>
                        <code className="mt-2 block portal-text-caption text-link">
                            components/ui/*
                        </code>
                    </div>
                    <div>
                        <h2 className="portal-text-body font-semibold">
                            03 / Shared surfaces
                        </h2>
                        <p className="mt-2 portal-text-caption leading-6 text-ink-600">
                            One panel style for Profile, Security, Sessions and
                            App Store cards.
                        </p>
                        <code className="mt-2 block break-all portal-text-caption text-link">
                            components/customer/portal-panel.tsx
                        </code>
                    </div>
                </div>
            </PortalPanel>
            <div className="mt-8 grid items-start gap-8 xl:grid-cols-[200px_minmax(0,1fr)]">
                <aside className="xl:sticky xl:top-20">
                    <Label htmlFor="component-search">Find a component</Label>
                    <Input
                        id="component-search"
                        type="search"
                        placeholder="Try input or dialog…"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                    <nav
                        aria-label="Component sections"
                        className="mt-4 flex flex-wrap gap-1 xl:flex-col"
                    >
                        {visible.map((section) => (
                            <a
                                key={section.id}
                                href={`#${section.id}`}
                                className="rounded-md px-3 py-2 portal-text-caption font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900"
                            >
                                {section.title}
                            </a>
                        ))}
                    </nav>
                    <p className="mt-4 portal-text-caption leading-5 text-ink-500">
                        Examples use sample data. Actions on this page do not
                        create sites or change your account.
                    </p>
                </aside>
                <div className="min-w-0 space-y-12">
                    {visible.length === 0 && (
                        <Notice tone="info">
                            No matching components. Try “button”, “input”,
                            “table” or “dialog”.
                        </Notice>
                    )}
                    {shown('foundations') && (
                        <Section id="foundations">
                            <Example
                                title="Palette & typography"
                                description="Portal colors inherit from the scoped theme. Inter is used for controls; Inter Tight for headings."
                                source="app/dashboard/portal.css · app/dashboard/layout.tsx"
                                code={
                                    '--primary: #141416;\n--border: #E7E7EA;\n--radius: 10px;\n--control-height: 32px;\n--control-font-size: 12px;'
                                }
                            >
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    {[
                                        'primary',
                                        'surface',
                                        'border',
                                        'muted',
                                        'positive',
                                        'caution',
                                        'critical',
                                        'neutral-accent',
                                    ].map((token) => (
                                        <div key={token}>
                                            <div
                                                className="h-12 rounded-md border border-ink-200"
                                                style={{
                                                    backgroundColor: `var(--${token})`,
                                                }}
                                            />
                                            <p className="mt-2 portal-text-caption text-ink-600">
                                                --{token}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                                <Separator className="my-6" />
                                <p
                                    className="text-2xl font-semibold"
                                    style={{
                                        fontFamily: 'var(--font-display)',
                                    }}
                                >
                                    Clear hierarchy, familiar controls.
                                </p>
                                <p className="mt-2 portal-text-body leading-6 text-ink-600">
                                    Body text · 14px / 24px. Labels, fields and
                                    buttons · shared 12px control token.
                                </p>
                            </Example>
                            <Example
                                title="Sizing playground"
                                description="These controls demonstrate token changes in this example only. Edit portal.css to apply the values across the customer panel."
                                source="app/dashboard/portal.css"
                                code={
                                    '/* Change once; used by Input, PasswordInput, Select and Button. */\n--control-height: 32px;\n--control-font-size: 12px;\n--control-radius: 6px;\n--dens: 1;'
                                }
                            >
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <Label htmlFor="preview-height">
                                            Control height
                                        </Label>
                                        <select
                                            id="preview-height"
                                            className="h-8 w-full rounded-md border border-input bg-white px-3 portal-text-caption"
                                            value={height}
                                            onChange={(event) =>
                                                setHeight(event.target.value)
                                            }
                                        >
                                            <option value="32">
                                                32px · Compact
                                            </option>
                                            <option value="36">
                                                36px · Comfortable
                                            </option>
                                            <option value="40">
                                                40px · Spacious
                                            </option>
                                        </select>
                                    </div>
                                    <div>
                                        <Label htmlFor="preview-density">
                                            Density
                                        </Label>
                                        <select
                                            id="preview-density"
                                            className="h-8 w-full rounded-md border border-input bg-white px-3 portal-text-caption"
                                            value={density}
                                            onChange={(event) =>
                                                setDensity(event.target.value)
                                            }
                                        >
                                            <option value="1">Default</option>
                                            <option value="1.15">
                                                Relaxed
                                            </option>
                                        </select>
                                    </div>
                                </div>
                                <div
                                    className="mt-5 flex flex-wrap items-end gap-3"
                                    style={
                                        {
                                            '--control-height': `${height}px`,
                                            '--dens': density,
                                        } as React.CSSProperties
                                    }
                                >
                                    <div className="min-w-0 flex-1">
                                        <Label htmlFor="sizing-preview">
                                            Workspace name
                                        </Label>
                                        <Input
                                            id="sizing-preview"
                                            placeholder="My workspace"
                                        />
                                    </div>
                                    <Button
                                        onClick={() =>
                                            setNotice(
                                                'This is a preview action.',
                                            )
                                        }
                                    >
                                        Save changes
                                    </Button>
                                </div>
                            </Example>
                        </Section>
                    )}
                    {shown('buttons') && (
                        <Section id="buttons">
                            <Example
                                title="Variants, sizes & states"
                                description="Use variants instead of repeating button colors on each page. Icon buttons need an accessible label."
                                source="components/ui/button.tsx · app/dashboard/portal.css"
                                code={
                                    '<Button>Save changes</Button>\n<Button variant="outline">Cancel</Button>\n<Button size="icon" aria-label="Add"><Plus /></Button>'
                                }
                            >
                                <div className="flex flex-wrap gap-3">
                                    {(
                                        [
                                            'default',
                                            'secondary',
                                            'outline',
                                            'ghost',
                                            'link',
                                            'destructive',
                                        ] as const
                                    ).map((variant) => (
                                        <Button
                                            key={variant}
                                            variant={variant}
                                            onClick={() =>
                                                setNotice(
                                                    `${variant} button clicked.`,
                                                )
                                            }
                                        >
                                            {variant === 'default'
                                                ? 'Primary'
                                                : variant}
                                        </Button>
                                    ))}
                                </div>
                                <Separator className="my-5" />
                                <div className="flex flex-wrap items-center gap-3">
                                    <Button size="sm">Small</Button>
                                    <Button>Default</Button>
                                    <Button size="lg">Large</Button>
                                    <Button
                                        size="icon"
                                        aria-label="Add example"
                                    >
                                        <Plus />
                                    </Button>
                                    <Button disabled>Disabled</Button>
                                    <Button disabled>
                                        <Loader2 className="size-4 animate-spin" />
                                        Saving…
                                    </Button>
                                    <Button variant="outline">
                                        <Download />
                                        Export
                                    </Button>
                                </div>
                            </Example>
                        </Section>
                    )}
                    {shown('fields') && (
                        <Section id="fields">
                            <div className="grid gap-5 md:grid-cols-2">
                                <Example
                                    title="Text, password & field feedback"
                                    description="Labels, inputs and buttons share the same sizing contract. Field helpers connect supporting text to the input."
                                    source="components/ui/input.tsx · password-input.tsx · label.tsx · form-field.tsx"
                                    code={
                                        '<FormField id="email" label="Email" help="Use your work email.">\n  <Input id="email" {...fieldAria("email", null, "help")} />\n</FormField>'
                                    }
                                >
                                    <div className="space-y-4">
                                        <FormField
                                            id="demo-name"
                                            label="Full name"
                                        >
                                            <Input
                                                id="demo-name"
                                                placeholder="Alex Morgan"
                                            />
                                        </FormField>
                                        <FormField
                                            id="demo-password"
                                            label="Password"
                                            help="Use at least 8 characters."
                                        >
                                            <PasswordInput
                                                id="demo-password"
                                                autoComplete="off"
                                                {...fieldAria(
                                                    'demo-password',
                                                    null,
                                                    'Use at least 8 characters.',
                                                )}
                                            />
                                        </FormField>
                                        <FormField
                                            id="demo-invalid"
                                            label="Email"
                                            error="Enter a valid email address."
                                        >
                                            <Input
                                                id="demo-invalid"
                                                defaultValue="alex@"
                                                {...fieldAria(
                                                    'demo-invalid',
                                                    'Enter a valid email address.',
                                                )}
                                            />
                                        </FormField>
                                        <FormField
                                            id="demo-disabled"
                                            label="Verified email"
                                        >
                                            <Input
                                                id="demo-disabled"
                                                disabled
                                                defaultValue="alex@example.test"
                                            />
                                        </FormField>
                                    </div>
                                </Example>
                                <Example
                                    title="Select & searchable options"
                                    description="Use Select for short lists; Autocomplete for options that benefit from search."
                                    source="components/ui/select.tsx · autocomplete.tsx"
                                    code={
                                        '<Select><SelectTrigger><SelectValue placeholder="Choose app" /></SelectTrigger>\n<SelectContent><SelectItem value="lending">Lending</SelectItem></SelectContent></Select>'
                                    }
                                >
                                    <div className="portal-fields">
                                        <div>
                                            <Label htmlFor="demo-app">
                                                Application
                                            </Label>
                                            <Select>
                                                <SelectTrigger id="demo-app">
                                                    <SelectValue placeholder="Choose an application" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="lending">
                                                        Lending
                                                    </SelectItem>
                                                    <SelectItem value="fbr">
                                                        FBR Integration
                                                    </SelectItem>
                                                    <SelectItem value="pos">
                                                        Point of Sale
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <FormField
                                            id="demo-country"
                                            label="Country"
                                        >
                                            <Autocomplete
                                                id="demo-country"
                                                name="demo-country"
                                                placeholder="Search countries…"
                                                options={[
                                                    {
                                                        value: 'pk',
                                                        label: 'Pakistan',
                                                    },
                                                    {
                                                        value: 'ae',
                                                        label: 'United Arab Emirates',
                                                    },
                                                    {
                                                        value: 'sa',
                                                        label: 'Saudi Arabia',
                                                    },
                                                ]}
                                            />
                                        </FormField>
                                        <FormField
                                            id="demo-message"
                                            label="Message"
                                            optional
                                        >
                                            <Textarea
                                                id="demo-message"
                                                rows={3}
                                                placeholder="Tell us what you need…"
                                            />
                                        </FormField>
                                    </div>
                                </Example>
                            </div>
                            <Example
                                title="Formatted numbers & verification code"
                                description="SmartInput displays formatted values while posting canonical numbers. OTP supports keyboard input and paste."
                                source="components/ui/smart-input.tsx · input-otp.tsx"
                                code={
                                    '<SmartInput name="amount" kind="currency" symbol="Rs" defaultValue="12500" />\n<InputOTP maxLength={6}><InputOTPGroup>…slots…</InputOTPGroup></InputOTP>'
                                }
                            >
                                <div className="grid gap-5 sm:grid-cols-2">
                                    <FormField id="demo-amount" label="Amount">
                                        <SmartInput
                                            id="demo-amount"
                                            name="amount"
                                            kind="currency"
                                            symbol="Rs"
                                            defaultValue="12500"
                                        />
                                    </FormField>
                                    <FormField
                                        id="demo-percent"
                                        label="Discount"
                                    >
                                        <SmartInput
                                            id="demo-percent"
                                            name="discount"
                                            kind="percent"
                                            defaultValue="12.5"
                                        />
                                    </FormField>
                                    <div className="sm:col-span-2">
                                        <Label htmlFor="demo-otp">
                                            Verification code
                                        </Label>
                                        <InputOTP
                                            id="demo-otp"
                                            aria-label="Example verification code"
                                            maxLength={6}
                                        >
                                            <InputOTPGroup>
                                                {[0, 1, 2, 3, 4, 5].map(
                                                    (index) => (
                                                        <InputOTPSlot
                                                            key={index}
                                                            index={index}
                                                        />
                                                    ),
                                                )}
                                            </InputOTPGroup>
                                        </InputOTP>
                                    </div>
                                </div>
                            </Example>
                        </Section>
                    )}
                    {shown('choices') && (
                        <Section id="choices">
                            <Example
                                title="Checkbox, switch & radio choices"
                                description="Checkboxes collect a value to save. Switches change state immediately. Radio buttons choose one option."
                                source="components/ui/checkbox.tsx · switch.tsx · native radio input"
                                code={
                                    '<Checkbox id="updates" /><Label htmlFor="updates">Product updates</Label>\n<Switch checked={enabled} onCheckedChange={setEnabled} />'
                                }
                            >
                                <div className="grid gap-6 sm:grid-cols-2">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <Checkbox id="demo-checkbox" />
                                            <Label
                                                htmlFor="demo-checkbox"
                                                className="mb-0!"
                                            >
                                                Include product updates
                                            </Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="demo-checked"
                                                defaultChecked
                                            />
                                            <Label
                                                htmlFor="demo-checked"
                                                className="mb-0!"
                                            >
                                                Email receipts
                                            </Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="demo-checkbox-disabled"
                                                disabled
                                            />
                                            <Label
                                                htmlFor="demo-checkbox-disabled"
                                                className="mb-0!"
                                            >
                                                Unavailable option
                                            </Label>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <Label
                                                htmlFor="demo-switch"
                                                className="mb-0!"
                                            >
                                                Preview notifications
                                            </Label>
                                            <Switch
                                                id="demo-switch"
                                                size="sm"
                                                checked={switchOn}
                                                onCheckedChange={setSwitchOn}
                                            />
                                        </div>
                                        <p className="portal-text-caption text-ink-500">
                                            Preview is{' '}
                                            {switchOn ? 'enabled' : 'disabled'}.
                                        </p>
                                        <fieldset className="flex gap-4 portal-text-caption">
                                            <legend className="mb-2 font-medium">
                                                Billing cycle
                                            </legend>
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name="demo-billing"
                                                    defaultChecked
                                                />
                                                Monthly
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name="demo-billing"
                                                />
                                                Yearly
                                            </label>
                                        </fieldset>
                                    </div>
                                </div>
                            </Example>
                        </Section>
                    )}
                    {shown('surfaces') && (
                        <Section id="surfaces">
                            <Example
                                title="Shared panels & semantic badges"
                                description="PortalPanel is the shared card surface. Badge colors describe status rather than introducing page-specific colors."
                                source="components/customer/portal-panel.tsx · components/ui/badge.tsx"
                                code={
                                    '<PortalPanel><h2>Workspace</h2><Badge variant="success">Ready</Badge></PortalPanel>'
                                }
                            >
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <PortalPanel>
                                        <Globe className="size-5 text-ink-500" />
                                        <h3 className="mt-4 font-semibold">
                                            Main workspace
                                        </h3>
                                        <p className="mt-2 portal-text-caption leading-5 text-ink-500">
                                            Sample site card using the shared
                                            surface.
                                        </p>
                                        <Badge
                                            variant="success"
                                            className="mt-4"
                                        >
                                            Ready
                                        </Badge>
                                    </PortalPanel>
                                    <div className="flex flex-wrap content-start gap-2">
                                        {(
                                            [
                                                'neutral',
                                                'success',
                                                'info',
                                                'warning',
                                                'error',
                                                'brand',
                                            ] as const
                                        ).map((tone) => (
                                            <Badge variant={tone} key={tone}>
                                                {tone}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </Example>
                            <Example
                                title="Notices & inline feedback"
                                description="Error notices announce an alert; success and informational notices announce a status."
                                source="components/ui/notice.tsx"
                                code={
                                    '<Notice tone="success">Your changes have been saved.</Notice>'
                                }
                            >
                                <div className="space-y-3">
                                    <Notice tone="success">
                                        Your changes have been saved.
                                    </Notice>
                                    <Notice tone="info">
                                        Your site is being prepared.
                                    </Notice>
                                    <Notice tone="warning">
                                        Check your server capacity before
                                        continuing.
                                    </Notice>
                                    <Notice tone="error">
                                        We could not save these changes. Try
                                        again.
                                    </Notice>
                                </div>
                            </Example>
                        </Section>
                    )}
                    {shown('navigation') && (
                        <Section id="navigation">
                            <Example
                                title="Shared navigation menu"
                                description="The same keyboard-accessible navigation primitive used by the public website, shown here in the portal theme. The sidebar around this page is also a live example."
                                source="components/ui/navigation-menu.tsx · sidebar.tsx · components/customer/customer-shell.tsx"
                                code={
                                    '<NavigationMenu><NavigationMenuList><NavigationMenuItem>\n  <NavigationMenuTrigger>Browse</NavigationMenuTrigger>\n  <NavigationMenuContent>…links…</NavigationMenuContent>\n</NavigationMenuItem></NavigationMenuList></NavigationMenu>'
                                }
                            >
                                <NavigationMenu>
                                    <NavigationMenuList>
                                        <NavigationMenuItem>
                                            <NavigationMenuTrigger>
                                                Browse examples
                                            </NavigationMenuTrigger>
                                            <NavigationMenuContent>
                                                <div className="grid w-56 gap-1 p-2">
                                                    <NavigationMenuLink href="#buttons">
                                                        Buttons and actions
                                                    </NavigationMenuLink>
                                                    <NavigationMenuLink href="#fields">
                                                        Fields and validation
                                                    </NavigationMenuLink>
                                                    <NavigationMenuLink href="#surfaces">
                                                        Panels and feedback
                                                    </NavigationMenuLink>
                                                </div>
                                            </NavigationMenuContent>
                                        </NavigationMenuItem>
                                    </NavigationMenuList>
                                </NavigationMenu>
                            </Example>
                            <Example
                                title="Tabs, accordion & breadcrumb"
                                description="Tabs switch between related views. Accordion reveals optional detail. The breadcrumb above uses the same shared primitive."
                                source="components/ui/tabs.tsx · accordion.tsx · breadcrumb.tsx · separator.tsx"
                                code={
                                    '<Tabs defaultValue="overview">\n  <TabsList><TabsTrigger value="overview">Overview</TabsTrigger></TabsList>\n  <TabsContent value="overview">…</TabsContent>\n</Tabs>'
                                }
                            >
                                <Tabs defaultValue="overview">
                                    <TabsList>
                                        <TabsTrigger value="overview">
                                            Overview
                                        </TabsTrigger>
                                        <TabsTrigger value="activity">
                                            Activity
                                        </TabsTrigger>
                                        <TabsTrigger value="disabled" disabled>
                                            Disabled
                                        </TabsTrigger>
                                    </TabsList>
                                    <TabsContent
                                        value="overview"
                                        className="py-4 portal-text-body text-ink-600"
                                    >
                                        Your workspace overview appears here.
                                    </TabsContent>
                                    <TabsContent
                                        value="activity"
                                        className="py-4 portal-text-body text-ink-600"
                                    >
                                        No new activity in this sample
                                        workspace.
                                    </TabsContent>
                                </Tabs>
                                <Separator className="my-3" />
                                <Accordion type="single" collapsible>
                                    <AccordionItem value="theme">
                                        <AccordionTrigger>
                                            Where do I change the styling?
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            Edit the portal theme tokens or the
                                            shared component. The library and
                                            customer screens use those same
                                            sources.
                                        </AccordionContent>
                                    </AccordionItem>
                                    <AccordionItem value="sidebar">
                                        <AccordionTrigger>
                                            What about the sidebar and header?
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            The navigation surrounding this page
                                            uses Sidebar, SidebarMenuButton,
                                            SidebarTrigger and the shared
                                            notification Popover. Public-site
                                            menus use NavigationMenu from
                                            components/ui/navigation-menu.tsx.
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            </Example>
                        </Section>
                    )}
                    {shown('tables') && (
                        <Section id="tables">
                            <Example
                                title="Searchable data table"
                                description="Table primitives keep headings, rows and empty results consistent. Sample search updates this table only."
                                source="components/ui/table.tsx · input.tsx · button.tsx · badge.tsx"
                                code={
                                    '<Table><TableHeader>…</TableHeader><TableBody>…</TableBody></Table>'
                                }
                            >
                                <Label htmlFor="table-search">
                                    Search example workspaces
                                </Label>
                                <Input
                                    id="table-search"
                                    type="search"
                                    placeholder="Filter by workspace or app…"
                                    value={rowsQuery}
                                    onChange={(event) =>
                                        setRowsQuery(event.target.value)
                                    }
                                />
                                <div className="mt-4">
                                    <Table>
                                        <TableCaption>
                                            Sample data for component preview.
                                        </TableCaption>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Workspace</TableHead>
                                                <TableHead>
                                                    Application
                                                </TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">
                                                    Actions
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {rows.map((row) => (
                                                <TableRow key={row.name}>
                                                    <TableCell className="font-medium">
                                                        {row.name}
                                                    </TableCell>
                                                    <TableCell>
                                                        {row.app}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant={row.tone}
                                                        >
                                                            {row.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            aria-label={`View ${row.name}`}
                                                            onClick={() =>
                                                                setNotice(
                                                                    `Viewing sample ${row.name}.`,
                                                                )
                                                            }
                                                        >
                                                            <ChevronRight />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {!rows.length && (
                                                <TableRow>
                                                    <TableCell
                                                        colSpan={4}
                                                        className="py-8 text-center text-ink-500"
                                                    >
                                                        No matching workspaces.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                                <div className="mt-4 flex items-center justify-between gap-3">
                                    <p className="portal-text-caption text-ink-500">
                                        {rows.length} example workspaces · Page
                                        1 of 1
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            disabled
                                            aria-label="Previous page"
                                        >
                                            <ChevronLeft />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            disabled
                                            aria-label="Next page"
                                        >
                                            <ChevronRight />
                                        </Button>
                                    </div>
                                </div>
                            </Example>
                        </Section>
                    )}
                    {shown('overlays') && (
                        <Section id="overlays">
                            <Example
                                title="Dialog, confirmation & side panel"
                                description="Working overlays inherit the customer theme, including when Radix renders them outside the page shell."
                                source="components/ui/dialog.tsx · alert-dialog.tsx · sheet.tsx · theme-scope.tsx"
                                code={
                                    '<Dialog><DialogTrigger asChild><Button>Open</Button></DialogTrigger>\n<DialogContent><DialogTitle>Preview</DialogTitle>…</DialogContent></Dialog>'
                                }
                            >
                                <div className="flex flex-wrap gap-3">
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button variant="outline">
                                                Open dialog
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>
                                                    Workspace details
                                                </DialogTitle>
                                                <DialogDescription>
                                                    This dialog demonstrates the
                                                    shared component. No account
                                                    data is changed.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <FormField
                                                id="dialog-name"
                                                label="Example workspace"
                                            >
                                                <Input
                                                    id="dialog-name"
                                                    defaultValue="Main workspace"
                                                />
                                            </FormField>
                                            <DialogClose asChild>
                                                <Button className="mt-4">
                                                    Done
                                                </Button>
                                            </DialogClose>
                                        </DialogContent>
                                    </Dialog>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="outline">
                                                Confirmation
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>
                                                    Confirm the example action?
                                                </AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This is a component demo. No
                                                    site or account will be
                                                    removed.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>
                                                    Cancel
                                                </AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={() =>
                                                        setNotice(
                                                            'Example action confirmed. No data was changed.',
                                                        )
                                                    }
                                                >
                                                    Confirm example
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                    <Sheet>
                                        <SheetTrigger asChild>
                                            <Button variant="outline">
                                                Open side panel
                                            </Button>
                                        </SheetTrigger>
                                        <SheetContent>
                                            <SheetHeader>
                                                <SheetTitle>
                                                    Workspace activity
                                                </SheetTitle>
                                                <SheetDescription>
                                                    A shared panel for details
                                                    without leaving the current
                                                    page.
                                                </SheetDescription>
                                            </SheetHeader>
                                            <div className="px-4">
                                                <Notice tone="info">
                                                    This is sample activity.
                                                </Notice>
                                            </div>
                                        </SheetContent>
                                    </Sheet>
                                </div>
                            </Example>
                            <Example
                                title="Popover, tooltip & action menu"
                                description="Small contextual surfaces for supporting information and related actions. Try each control."
                                source="components/ui/popover.tsx · tooltip.tsx · dropdown-menu.tsx"
                                code={
                                    '<Tooltip><TooltipTrigger asChild><Button>Help</Button></TooltipTrigger>\n<TooltipContent>Supporting text</TooltipContent></Tooltip>'
                                }
                            >
                                <div className="flex flex-wrap gap-3">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline">
                                                View popover
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-64 p-4">
                                            <h3 className="portal-text-body font-semibold">
                                                Quick details
                                            </h3>
                                            <p className="mt-2 portal-text-caption leading-5 text-ink-600">
                                                A compact surface for
                                                information related to the
                                                current action.
                                            </p>
                                        </PopoverContent>
                                    </Popover>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="outline">
                                                Hover for help
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Tooltips also appear on keyboard
                                            focus.
                                        </TooltipContent>
                                    </Tooltip>
                                    <DropdownMenu
                                        trigger={
                                            <Button variant="outline">
                                                <MoreHorizontal />
                                                Actions
                                            </Button>
                                        }
                                    >
                                        <DropdownMenuLabel>
                                            Sample workspace
                                        </DropdownMenuLabel>
                                        <DropdownMenuItem
                                            icon={<Copy />}
                                            onSelect={() =>
                                                setNotice(
                                                    'Example duplicate action selected.',
                                                )
                                            }
                                        >
                                            Duplicate
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            icon={<Download />}
                                            onSelect={() =>
                                                setNotice(
                                                    'Example export action selected.',
                                                )
                                            }
                                        >
                                            Export
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem disabled>
                                            Unavailable action
                                        </DropdownMenuItem>
                                    </DropdownMenu>
                                </div>
                            </Example>
                        </Section>
                    )}
                    {shown('loading') && (
                        <Section id="loading">
                            <div className="grid gap-5 md:grid-cols-2">
                                <Example
                                    title="Skeleton & progress"
                                    description="Use skeletons when the content shape is known. Show explicit progress only when it can be measured."
                                    source="components/ui/skeleton.tsx · native progress element"
                                    code={
                                        '<Skeleton className="h-4 w-32" />\n<progress aria-label="Installation progress" value={60} max={100} />'
                                    }
                                >
                                    <div
                                        aria-label="Example loading content"
                                        role="status"
                                        className="space-y-3"
                                    >
                                        <Skeleton className="size-10" />
                                        <Skeleton className="h-4 w-3/4" />
                                        <Skeleton className="h-4 w-1/2" />
                                        <span className="sr-only">
                                            Loading sample content
                                        </span>
                                    </div>
                                    <Label
                                        htmlFor="demo-progress"
                                        className="mt-6"
                                    >
                                        Installation progress · 60%
                                    </Label>
                                    <progress
                                        id="demo-progress"
                                        max={100}
                                        value={60}
                                        className="h-2 w-full accent-primary"
                                    />
                                </Example>
                                <Example
                                    title="Empty state"
                                    description="Explain why content is absent and provide a clear next action."
                                    source="components/customer/portal-panel.tsx · components/ui/button.tsx"
                                    code={
                                        '<PortalPanel><h3>No workspaces yet</h3><Button>Create workspace</Button></PortalPanel>'
                                    }
                                >
                                    <div className="py-5 text-center">
                                        <Globe className="mx-auto size-8 text-ink-400" />
                                        <h3 className="mt-4 portal-text-body font-semibold">
                                            No workspaces yet
                                        </h3>
                                        <p className="mt-2 portal-text-caption leading-5 text-ink-500">
                                            Create your first workspace to get
                                            started.
                                        </p>
                                        <Button
                                            className="mt-4"
                                            onClick={() =>
                                                setNotice(
                                                    'Create workspace is a preview action here.',
                                                )
                                            }
                                        >
                                            <Plus />
                                            Create workspace
                                        </Button>
                                    </div>
                                </Example>
                            </div>
                        </Section>
                    )}
                </div>
            </div>
            {notice && (
                <div
                    className="fixed right-4 bottom-4 z-40 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg border border-ink-200 bg-white p-4 shadow-lg"
                    role="status"
                >
                    <Check className="size-4 shrink-0 text-success-700" />
                    <p className="portal-text-caption">{notice}</p>
                    <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Dismiss feedback"
                        onClick={() => setNotice('')}
                    >
                        <X />
                    </Button>
                </div>
            )}
        </div>
    );
}
