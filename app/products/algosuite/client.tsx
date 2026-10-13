'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
    ArrowDown,
    ArrowRight,
    ArrowUpRight,
    Boxes,
    Check,
    CircleDollarSign,
    Factory,
    PackageCheck,
    ShoppingBag,
    Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';

const modules = [
    {
        id: 'finance',
        label: 'Finance',
        icon: CircleDollarSign,
        title: 'Know where your business stands.',
        description:
            'Bring invoices, expenses, and financial reporting into the same conversation. Give your finance team the context behind the numbers, without chasing updates from every department.',
        features: [
            'Customer invoices and supplier bills',
            'Receivables, payables, and expense tracking',
            'Financial reports built around shared records',
        ],
        metric: 'Receivables',
        value: '248,500',
        unit: 'PKR',
        columns: ['Invoice', 'Customer', 'Status'],
        rows: [
            ['INV-1042', 'Atlas Trading', 'Paid'],
            ['INV-1043', 'Northline Supply', 'Due'],
            ['INV-1044', 'Studio & Co.', 'Draft'],
        ],
    },
    {
        id: 'inventory',
        label: 'Inventory',
        icon: Boxes,
        title: 'Keep stock moving. Keep everyone informed.',
        description:
            'Plan a clearer view of what is available, what is committed, and what needs replenishing. Connect the warehouse with purchasing and sales so teams work from the same stock records.',
        features: [
            'Item records and warehouse visibility',
            'Stock receipts, transfers, and adjustments',
            'Reorder planning and purchasing context',
        ],
        metric: 'Items tracked',
        value: '1,284',
        unit: 'SKU',
        columns: ['Item', 'Warehouse', 'Status'],
        rows: [
            ['Packing materials', 'Main warehouse', 'In stock'],
            ['Office supplies', 'Main warehouse', 'Reorder'],
            ['Finished goods', 'Dispatch', 'Reserved'],
        ],
    },
    // {
    //     id: 'sales',
    //     label: 'Sales & CRM',
    //     icon: ShoppingBag,
    //     title: 'A better handoff from enquiry to order.',
    //     description:
    //         'Keep customer conversations, quotations, and orders together. Let the next person see what was agreed, what needs to happen, and where the relationship stands.',
    //     features: [
    //         'Lead and customer records',
    //         'Quotations and sales order tracking',
    //         'A shared history for customer follow-ups',
    //     ],
    //     metric: 'Open opportunities',
    //     value: '24',
    //     unit: 'LEADS',
    //     columns: ['Opportunity', 'Owner', 'Status'],
    //     rows: [
    //         ['Atlas expansion', 'Sales team', 'Quotation'],
    //         ['Northline reorder', 'Sales team', 'Confirmed'],
    //         ['Studio onboarding', 'Account team', 'Follow-up'],
    //     ],
    // },
    {
        id: 'people',
        label: 'People & HR',
        icon: Users,
        title: 'Less paperwork between you and your people.',
        description:
            'Organise employee information and everyday HR tasks in one place. Help people teams spend less time piecing together records and more time supporting the business.',
        features: [
            'Central employee records',
            'Attendance and leave workflows',
            'Payroll preparation and people reporting',
            'Recruitment, applicant sources, and hiring metrics',
        ],
        metric: 'Team members',
        value: '86',
        unit: 'PEOPLE',
        columns: ['Request', 'Team', 'Status'],
        rows: [
            ['Annual leave', 'Operations', 'Approved'],
            ['New starter', 'Finance', 'Onboarding'],
            ['Attendance review', 'Warehouse', 'Review'],
        ],
    },
    // {
    //     id: 'operations',
    //     label: 'Operations',
    //     icon: ClipboardList,
    //     title: 'Give everyday work a clear next step.',
    //     description:
    //         'Connect purchasing and operational tasks with the teams that depend on them. Make ownership and progress visible, so work moves forward without another spreadsheet.',
    //     features: [
    //         'Purchase requests and supplier records',
    //         'Operational tasks and approval workflows',
    //         'Progress reporting across departments',
    //     ],
    //     metric: 'Active requests',
    //     value: '18',
    //     unit: 'TASKS',
    //     columns: ['Request', 'Owner', 'Status'],
    //     rows: [
    //         ['Material purchase', 'Procurement', 'Approved'],
    //         ['Supplier review', 'Operations', 'Review'],
    //         ['Dispatch plan', 'Warehouse', 'Scheduled'],
    //     ],
    // },
];

const workflow = [
    {
        icon: ShoppingBag,
        label: 'Sales',
        title: 'An order comes in',
        text: 'Customer details, agreed prices, and items stay with the order.',
    },
    {
        icon: Boxes,
        label: 'Inventory',
        title: 'Stock is checked',
        text: 'The warehouse sees what needs to be reserved and prepared.',
    },
    {
        icon: PackageCheck,
        label: 'Operations',
        title: 'The team delivers',
        text: 'Dispatch and fulfilment follow the same order context.',
    },
    {
        icon: CircleDollarSign,
        label: 'Finance',
        title: 'The books catch up',
        text: 'Invoicing and payment tracking connect back to the sale.',
    },
];

const industries = [
    {
        icon: ShoppingBag,
        title: 'Retail & distribution',
        text: 'Bring purchasing, stock, customer orders, and invoicing into a connected working day.',
        detail: 'Stock visibility · Orders · Purchasing',
    },
    {
        icon: Factory,
        title: 'Manufacturing',
        text: 'Explore how material records, purchasing, and operational planning can work together.',
        detail: 'Materials · Suppliers · Planning',
    },
    {
        icon: Users,
        title: 'Service businesses',
        text: 'Keep customers, team records, everyday tasks, and financial administration in the same place.',
        detail: 'Customers · People · Finance',
    },
];

const rollout = [
    {
        title: 'Understand your business',
        text: 'Map the processes you use today, the handoffs that slow you down, and the records your teams rely on.',
    },
    {
        title: 'Agree on the starting point',
        text: 'Choose the priority workflows, review your data, and define what a useful first rollout should include.',
    },
    {
        title: 'Prepare your people',
        text: 'Plan configuration, data migration, and training around the people who will use the system every day.',
    },
    {
        title: 'Build from there',
        text: 'Review the first phase, resolve friction, and plan additional workflows as your business needs develop.',
    },
];

const questions = [
    {
        question: 'Is AlgoSuite available today?',
        answer: 'AlgoSuite is currently in development. This page describes the planned direction of the platform; the screenshots show preview dashboards. Contact UnityAlgo to discuss your requirements and ask about availability. We have not announced a public launch date.',
    },
    {
        question: 'Which business functions are planned?',
        answer: 'The planned scope covers finance, inventory, sales and CRM, people and HR, and core operations. Final features and availability will be confirmed as development progresses.',
    },
    {
        question: 'Can we discuss our existing software and data?',
        answer: 'Yes. Tell us which tools you use, what data you need to preserve, and which systems must stay connected. Migration and integration requirements need to be reviewed individually before a scope or commitment is agreed.',
    },
    {
        question: 'How much will AlgoSuite cost?',
        answer: 'Pricing has not been published. The number of users, required workflows, configuration, and implementation support are useful starting points for a conversation. Contact our team to discuss your needs.',
    },
    {
        question: 'What if we need a solution before AlgoSuite launches?',
        answer: 'UnityAlgo also provides tailored software development and ERP implementation services. We can discuss your current requirements and whether an existing solution or a custom build is a suitable next step.',
    },
];

const screenshots = {
    workspace: {
        src: '/images/algosuite/workspace.png',
        width: 1464,
        height: 866,
        alt: 'AlgoSuite home workspace with accounting, stock, CRM, and data import shortcuts',
    },
    finance: {
        src: '/images/algosuite/finance.png',
        width: 1078,
        height: 837,
        alt: 'AlgoSuite Accounts Dashboard showing bills, incoming and outgoing payments, profit and loss, and invoice trends',
    },
    inventory: {
        src: '/images/algosuite/inventory.png',
        width: 1085,
        height: 749,
        alt: 'AlgoSuite Stock Dashboard showing active items, warehouses, stock valuation, purchase receipts, and delivery trends',
    },
    people: {
        src: '/images/algosuite/people-hr.png',
        width: 1611,
        height: 945,
        alt: 'AlgoSuite Recruitment Dashboard showing applicants, acceptance rate, time to fill, applicant sources, and application status',
    },
};

const financeDetails = [
    {
        title: 'Invoices & outstanding balances',
        text: 'Bring customer invoices and supplier bills into a shared finance workflow. Keep the amount due, payment status, and underlying customer or supplier record together.',
        points: [
            'Sales and purchase invoices',
            'Receivable and payable tracking',
        ],
    },
    {
        title: 'Incoming & outgoing payments',
        text: 'See money received and money paid alongside your bills. The accounts dashboard brings both directions of cash movement into view, so your team has context for the next payment decision.',
        points: [
            'Incoming and outgoing payment totals',
            'Payment context alongside invoices',
        ],
    },
    {
        title: 'Income, expenses & profitability',
        text: 'Read income and expenses side by side, with net profit or loss shown in the same view. Give your team a practical starting point for reviewing financial performance over the selected period.',
        points: ['Income and expense comparison', 'Profit and loss dashboard'],
    },
    {
        title: 'Accounts & financial reporting',
        text: 'Organise the records behind the numbers with a chart of accounts and connected customer and supplier information. Review invoice trends over time and plan reporting around the questions your business asks.',
        points: [
            'Chart of accounts and financial records',
            'Monthly sales and purchase invoice trends',
        ],
    },
];

function WorkspacePreview({
    module = modules[0],
    sidebar = false,
}: {
    module?: (typeof modules)[number];
    sidebar?: boolean;
}) {
    const screenshot = sidebar
        ? screenshots.workspace
        : screenshots[module.id as keyof typeof screenshots];
    return (
        <a
            href={screenshot.src}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open full-size image: ${screenshot.alt}`}
            className="group block overflow-hidden rounded-lg border border-ink-200 bg-white shadow-xl shadow-ink-900/5 focus-visible:outline-2 focus-visible:outline-offset-4"
        >
            <Image
                src={screenshot.src}
                alt={screenshot.alt}
                width={screenshot.width}
                height={screenshot.height}
                priority={sidebar}
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="h-auto w-full transition-opacity group-hover:opacity-90"
            />
        </a>
    );
}
const eyebrow = 'text-xs font-semibold uppercase tracking-[0.16em] text-brand';
const heading =
    'mt-4 text-3xl font-semibold leading-tight tracking-tight md:text-5xl';
const container = 'container mx-auto max-w-7xl';
const section = 'scroll-mt-24 px-4 py-20 md:px-6 md:py-28';

export const MainContent = () => (
    <main>
        <section
            id="overview"
            className="scroll-mt-24 bg-ink-50 px-4 pb-16 pt-32 md:px-6 md:pb-20 md:pt-40"
        >
            <div className={container}>
                {/* <div className="mb-10 flex gap-2 text-xs text-ink-500">
                    <Link href="/" className="hover:text-brand">
                        Home
                    </Link>
                    <span>/</span>
                    <span>Products</span>
                    <span>/</span>
                    <span className="text-ink-900">AlgoSuite</span>
                </div> */}
                <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.08fr] lg:gap-16">
                    <div>
                        <div className="mb-6 flex flex-wrap items-center gap-3">
                            <span className="text-sm font-semibold text-brand">
                                AlgoSuite / Business management
                            </span>
                            <span className="border-l border-ink-300 pl-3 text-xs text-ink-500">
                                In development
                            </span>
                        </div>
                        <h1 className="max-w-xl text-5xl font-semibold leading-[1.06] tracking-[-0.045em] sm:text-6xl xl:text-7xl">
                            Your whole business.
                            <br />
                            <span className="text-brand">
                                Working together.
                            </span>
                        </h1>
                        <p className="mt-7 max-w-lg text-lg leading-relaxed text-ink-600">
                            The order. The stock. The invoice. The people behind
                            it all. AlgoSuite is being built to bring them into
                            one connected business platform.
                        </p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <Button asChild size="lg" className="h-12 px-6">
                                <Link href="#contact">
                                    Talk about your business{' '}
                                    <ArrowUpRight className="size-4" />
                                </Link>
                            </Button>
                            <Button
                                asChild
                                variant="outline"
                                size="lg"
                                className="h-12 px-6"
                            >
                                <Link href="#modules">
                                    Explore the AlgoSuite{' '}
                                    <ArrowDown className="size-4" />
                                </Link>
                            </Button>
                        </div>
                        <p className="mt-5 text-xs text-ink-500">
                            Built by UnityAlgo. Planned around the way your
                            teams work.
                        </p>
                    </div>
                    <div className="min-w-0 border-l-2 border-brand pl-4 sm:pl-6">
                        <div className="mb-4 flex justify-between gap-3 text-[10px] tracking-wider text-ink-500">
                            <span>ONE WORKSPACE. A SHARED PICTURE.</span>
                            <span className="font-mono">WORKSPACE</span>
                        </div>
                        <WorkspacePreview sidebar />
                        <p className="mt-4 text-xs text-ink-500">
                            AlgoSuite workspace. The product is still in
                            development.
                        </p>
                    </div>
                </div>
            </div>
        </section>

        <nav
            aria-label="AlgoSuite page sections"
            className="border-y border-ink-200 px-4 md:px-6"
        >
            <div
                className={`${container} flex items-center gap-8 overflow-x-auto py-5 text-sm`}
            >
                <span className="hidden shrink-0 border-r border-ink-200 pr-8 font-semibold sm:block">
                    AlgoSuite
                </span>
                {[
                    ['Overview', 'overview'],
                    ['Modules', 'modules'],
                    ['How it connects', 'workflow'],
                    ['Industries', 'industries'],
                    ['Implementation', 'implementation'],
                    ['FAQs', 'faqs'],
                ].map(([label, id]) => (
                    <a
                        key={id}
                        href={`#${id}`}
                        className="shrink-0 text-ink-600 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-4"
                    >
                        {label}
                    </a>
                ))}
            </div>
        </nav>

        <section className={section}>
            <div className={container}>
                <div className="grid gap-8 md:grid-cols-[0.65fr_1fr]">
                    <p className={eyebrow}>A clearer way to work</p>
                    <div>
                        <h2 className="text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
                            Your teams are connected.
                            <br />
                            Your software should be, too.
                        </h2>
                        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-600">
                            When a sale changes stock, affects cash flow, and
                            creates work for another team, separate tools leave
                            gaps. AlgoSuite starts with those everyday
                            connections.
                        </p>
                    </div>
                </div>
                <div className="mt-14 grid gap-8 border-t border-ink-200 pt-8 md:grid-cols-3">
                    {[
                        [
                            'A shared source of context',
                            'Keep the customer, item, and transaction records behind your work together, so each team can see the same story.',
                        ],
                        [
                            'Fewer manual handoffs',
                            'Plan workflows that carry information between departments, instead of copying it into another spreadsheet.',
                        ],
                        [
                            'A view beyond one department',
                            'Bring operational and financial context together to help people make better-informed decisions.',
                        ],
                    ].map(([title, text], index) => (
                        <div key={title}>
                            <span className="font-mono text-xs text-brand">
                                0{index + 1}
                            </span>
                            <h3 className="mt-5 text-xl font-semibold">
                                {title}
                            </h3>
                            <p className="mt-3 text-sm leading-7 text-ink-600">
                                {text}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>

        <section id="modules" className={`${section} bg-ink-50`}>
            <div className={container}>
                <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
                    <div>
                        <p className={eyebrow}>Explore the planned modules</p>
                        <h2 className={heading}>Different teams. One suite.</h2>
                    </div>
                    <p className="max-w-sm text-sm leading-6 text-ink-600">
                        Start with the work that matters to you. See how each
                        part fits into the bigger picture.
                    </p>
                </div>
                <Tabs defaultValue="finance" className="gap-0">
                    <div className="overflow-x-auto border-b border-ink-200">
                        <TabsList
                            aria-label="Planned business modules"
                            className="h-auto w-max min-w-full justify-start gap-3 rounded-none bg-transparent p-0 sm:gap-7"
                        >
                            {modules.map((module) => (
                                <TabsTrigger
                                    key={module.id}
                                    value={module.id}
                                    className="h-14 flex-none gap-2 rounded-none border-0 border-b-2 border-transparent px-2 text-ink-600 data-[state=active]:border-brand data-[state=active]:bg-transparent data-[state=active]:text-brand data-[state=active]:shadow-none"
                                >
                                    <module.icon className="size-4" />
                                    {module.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>
                    {modules.map((module) => (
                        <TabsContent
                            key={module.id}
                            value={module.id}
                            className="pt-10"
                        >
                            <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1fr] lg:gap-20">
                                <div>
                                    <p className="text-xs uppercase tracking-wider text-ink-500">
                                        Planned capabilities / {module.label}
                                    </p>
                                    <h3 className="mt-4 max-w-lg text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                                        {module.title}
                                    </h3>
                                    <p className="mt-5 text-base leading-7 text-ink-600">
                                        {module.description}
                                    </p>
                                    <ul className="mt-6 space-y-3">
                                        {module.features.map((feature) => (
                                            <li
                                                key={feature}
                                                className="flex items-start gap-3 text-sm text-ink-700"
                                            >
                                                <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>
                                    <a
                                        href="#contact"
                                        className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline"
                                    >
                                        Discuss your requirements{' '}
                                        <ArrowRight className="size-4" />
                                    </a>
                                </div>
                                <div className="min-w-0">
                                    <WorkspacePreview module={module} />
                                    <p className="mt-4 text-xs leading-6 text-ink-500">
                                        AlgoSuite dashboard. Open the image for
                                        a closer look. Final features may
                                        change.
                                    </p>
                                </div>
                            </div>
                            {module.id === 'finance' && (
                                <div className="mt-12 border-t border-ink-200 pt-10">
                                    <div className="grid gap-5 md:grid-cols-2">
                                        <div>
                                            <p className={eyebrow}>
                                                A closer look at finance
                                            </p>
                                            <h3 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
                                                From the first invoice to the
                                                bigger picture.
                                            </h3>
                                        </div>
                                        <p className="max-w-lg text-sm leading-7 text-ink-600">
                                            Your accounts dashboard brings
                                            bills, payments, profitability, and
                                            invoice trends together. These are
                                            the workflows behind that view, with
                                            final scope confirmed as development
                                            progresses.
                                        </p>
                                    </div>
                                    <div className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-2">
                                        {financeDetails.map((detail, index) => (
                                            <article
                                                key={detail.title}
                                                className="border-t border-ink-200 pt-6"
                                            >
                                                <span className="font-mono text-xs text-brand">
                                                    0{index + 1}
                                                </span>
                                                <h4 className="mt-3 text-lg font-semibold">
                                                    {detail.title}
                                                </h4>
                                                <p className="mt-3 text-sm leading-7 text-ink-600">
                                                    {detail.text}
                                                </p>
                                                <ul className="mt-4 space-y-2">
                                                    {detail.points.map(
                                                        (point) => (
                                                            <li
                                                                key={point}
                                                                className="flex items-start gap-2 text-sm text-ink-700"
                                                            >
                                                                <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                                                                {point}
                                                            </li>
                                                        ),
                                                    )}
                                                </ul>
                                            </article>
                                        ))}
                                    </div>
                                    <div className="mt-8 border-l-2 border-brand bg-white p-6">
                                        <h4 className="font-semibold">
                                            Follow the transaction, not another
                                            spreadsheet.
                                        </h4>
                                        <p className="mt-2 text-sm leading-7 text-ink-600">
                                            A customer order becomes an invoice.
                                            A supplier bill creates an amount to
                                            pay. Payments and expenses feed the
                                            financial picture. AlgoSuite is
                                            being designed to keep those records
                                            connected, so the numbers can be
                                            traced back to the work behind them.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </TabsContent>
                    ))}
                </Tabs>
            </div>
        </section>

        <section id="workflow" className={`${section} bg-ink-950 text-white`}>
            <div className={container}>
                <div className="grid gap-6 md:grid-cols-2">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-300">
                            The connected business
                        </p>
                        <h2 className={heading}>
                            One order.
                            <br />A whole team in sync.
                        </h2>
                    </div>
                    <p className="max-w-lg self-end text-base leading-7 text-ink-300">
                        Here is the kind of everyday workflow AlgoSuite is being
                        designed around. Each team handles its part, with the
                        same information following the work.
                    </p>
                </div>
                <ol className="mt-14 grid md:grid-cols-4">
                    {workflow.map((step, index) => (
                        <li
                            key={step.label}
                            className="relative border-t border-white/20 py-8 pr-6 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0"
                        >
                            <div className="flex justify-between">
                                <step.icon className="size-6 text-ink-300" />
                                <span className="font-mono text-xs text-ink-300">
                                    0{index + 1}
                                </span>
                            </div>
                            <p className="mt-8 text-xs uppercase tracking-wider text-ink-300">
                                {step.label}
                            </p>
                            <h3 className="mt-3 text-xl font-semibold">
                                {step.title}
                            </h3>
                            <p className="mt-3 text-sm leading-7 text-ink-300">
                                {step.text}
                            </p>
                            {index < 3 && (
                                <ArrowRight className="absolute -right-3 top-12 hidden size-5 bg-ink-950 text-ink-300 md:block" />
                            )}
                        </li>
                    ))}
                </ol>
                <p className="border-t border-white/20 pt-6 text-sm leading-6 text-ink-300">
                    The goal: a shared view of progress, from the first order to
                    the final payment.
                </p>
            </div>
        </section>

        <section id="industries" className={section}>
            <div className={container}>
                <p className={eyebrow}>Built around real work</p>
                <h2 className={`${heading} max-w-2xl`}>
                    Every business has its own moving parts.
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-7 text-ink-600">
                    The starting point is your workflow. These are some of the
                    business contexts we are considering as the platform takes
                    shape.
                </p>
                <div className="mt-12 grid gap-6 md:grid-cols-3">
                    {industries.map((industry) => (
                        <article
                            key={industry.title}
                            className="flex flex-col border border-ink-200 p-7 transition-colors hover:border-ink-400"
                        >
                            <industry.icon className="size-7 text-brand" />
                            <h3 className="mt-7 text-2xl font-semibold tracking-tight">
                                {industry.title}
                            </h3>
                            <p className="mt-4 flex-1 text-sm leading-7 text-ink-600">
                                {industry.text}
                            </p>
                            <p className="mt-7 border-t border-ink-200 pt-5 text-xs leading-6 text-ink-500">
                                {industry.detail}
                            </p>
                            <a
                                href="#contact"
                                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold"
                            >
                                Discuss your workflow{' '}
                                <ArrowUpRight className="size-4" />
                            </a>
                        </article>
                    ))}
                </div>
            </div>
        </section>

        <section className="border-y border-ink-200 bg-ink-50">
            <div className="mx-auto grid max-w-7xl lg:grid-cols-2">
                <div className="relative min-h-72 lg:min-h-[460px]">
                    <Image
                        src="/images/services/software-development.jpg"
                        alt="A software team collaborating around a table of laptops"
                        fill
                        sizes="(min-width: 1024px) 50vw, 100vw"
                        className="object-cover"
                    />
                </div>
                <div className="px-6 py-12 md:p-14 lg:p-16">
                    <p className={eyebrow}>The people behind the platform</p>
                    <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
                        Software is only useful when it fits the work.
                    </h2>
                    <p className="mt-6 text-base leading-7 text-ink-600">
                        UnityAlgo builds business software and works on ERP
                        implementations. That experience shapes the questions
                        behind AlgoSuite: who needs this information, what
                        happens next, and where does the process get stuck?
                    </p>
                    <p className="mt-7 border-t border-ink-200 pt-6 text-sm leading-7 text-ink-600">
                        Permissions, data handling, and system connections
                        belong in the requirements conversation from the
                        beginning.
                    </p>
                    <Link
                        href="/about-us"
                        className="mt-7 inline-flex items-center gap-2 text-sm font-semibold"
                    >
                        Meet UnityAlgo <ArrowUpRight className="size-4" />
                    </Link>
                </div>
            </div>
        </section>

        <section id="implementation" className={section}>
            <div className={container}>
                <div className="grid gap-6 md:grid-cols-2">
                    <div>
                        <p className={eyebrow}>A considered rollout</p>
                        <h2 className={heading}>
                            Start with the right questions.
                        </h2>
                    </div>
                    <p className="max-w-lg self-end text-base leading-7 text-ink-600">
                        A new system affects more than your software. This is
                        the approach we would discuss with your team before
                        agreeing an implementation.
                    </p>
                </div>
                <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                    {rollout.map((step, index) => (
                        <div
                            key={step.title}
                            className="border-t border-ink-300 pt-5"
                        >
                            <span className="font-mono text-sm text-brand">
                                0{index + 1}
                            </span>
                            <h3 className="mt-6 text-xl font-semibold">
                                {step.title}
                            </h3>
                            <p className="mt-3 text-sm leading-7 text-ink-600">
                                {step.text}
                            </p>
                        </div>
                    ))}
                </div>
                <div className="mt-12 flex flex-col justify-between gap-4 border-l-2 border-brand bg-ink-50 p-6 sm:flex-row sm:items-center">
                    <p className="text-sm leading-6 text-ink-600">
                        Need something sooner? We also work on custom software
                        and ERP implementations.
                    </p>
                    <Link
                        href="/services/digital-product-engineering"
                        className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold"
                    >
                        Explore our services <ArrowUpRight className="size-4" />
                    </Link>
                </div>
            </div>
        </section>

        <section id="faqs" className={`${section} border-t border-ink-200`}>
            <div
                className={`${container} grid gap-10 lg:grid-cols-[0.7fr_1fr]`}
            >
                <div>
                    <p className={eyebrow}>Before we talk</p>
                    <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
                        A few things
                        <br />
                        you might be wondering.
                    </h2>
                    <p className="mt-5 max-w-sm text-sm leading-7 text-ink-600">
                        We are still building AlgoSuite. Here is what we can
                        share at this stage.
                    </p>
                </div>
                <Accordion type="single" collapsible>
                    {questions.map((item, index) => (
                        <AccordionItem
                            key={item.question}
                            value={`question-${index}`}
                            className="border-ink-200"
                        >
                            <AccordionTrigger className="py-6 pr-2 text-base">
                                {item.question}
                            </AccordionTrigger>
                            <AccordionContent className="max-w-2xl pb-6 text-sm leading-7 text-ink-600">
                                {item.answer}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </section>

        <section id="contact" className={`${section} bg-ink-100`}>
            <div
                className={`${container} grid gap-10 md:grid-cols-[1fr_0.7fr] md:items-center`}
            >
                <div>
                    <p className={eyebrow}>Let us start with your business</p>
                    <h2 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
                        What would a more connected working day look like?
                    </h2>
                    <p className="mt-6 max-w-xl text-base leading-7 text-ink-600">
                        Tell us what you use today, where the friction is, and
                        what your team needs next. We will talk through whether
                        the direction of AlgoSuite fits your business.
                    </p>
                </div>
                <div className="border-l border-ink-300 pl-6 md:pl-10">
                    <h3 className="text-xl font-semibold">
                        Have a conversation with UnityAlgo.
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-ink-600">
                        Bring your questions about modules, availability, or
                        implementation. A clear starting point is enough.
                    </p>
                    <Button asChild size="lg" className="mt-6 h-12 px-6">
                        <Link href="/#contact">
                            Contact our team <ArrowUpRight className="size-4" />
                        </Link>
                    </Button>
                    <p className="mt-4 text-xs leading-6 text-ink-500">
                        AlgoSuite is in development. Launch timing and pricing
                        are to be confirmed.
                    </p>
                </div>
            </div>
        </section>
    </main>
);

