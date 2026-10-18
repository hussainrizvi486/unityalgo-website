'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
    ArrowDown,
    ArrowRight,
    ArrowUpRight,
    ArrowLeftRight,
    BarChart3,
    Boxes,
    Building2,
    Clock,
    Coins,
    Globe,
    Languages,
    RotateCcw,
    ScanBarcode,
    Target,
    TrendingUp,
    Truck,
    CalendarCheck,
    FileText,
    Landmark,
    Scale,
    UserPlus,
    Wallet,
    Warehouse,
    Check,
    CircleDollarSign,
    ClipboardList,
    Factory,
    FolderKanban,
    Headphones,
    PackageCheck,
    Receipt,
    ShieldCheck,
    ShoppingBag,
    ShoppingCart,
    UserRound,
    Users,
    type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';

const plannedModules = [
    { name: 'Procurement', icon: ShoppingCart, text: 'Connect purchase requests, supplier quotations, purchase orders, and receipts.' },
    { name: 'Selling', icon: ShoppingBag, text: 'Connect quotations, customer orders, POS checkout, detailed invoicing, and payments with stock and accounting.' },
    { name: 'CRM', icon: UserRound, text: 'Keep leads, opportunities, customer conversations, and follow-ups in one shared view.' },
    { name: 'Accounting', icon: CircleDollarSign, text: 'Bring invoices, payments, expenses, and financial reports together around connected records.' },
    { name: 'Stock', icon: Boxes, text: 'Track items across warehouses, with receipts, transfers, and replenishment planning.' },
    { name: 'Manufacturing', icon: Factory, text: 'Plan materials and production with bills of materials, work orders, and production schedules.' },
    { name: 'Projects', icon: FolderKanban, text: 'Organise project tasks, responsibilities, timelines, and costs so teams can follow progress.' },
    { name: 'Point of Sale', icon: Receipt, text: 'Connect checkout, customer receipts, and retail payments with stock and accounting records.' },
    { name: 'Quality', icon: ShieldCheck, text: 'Record inspections, quality checks, and corrective actions across purchasing and production.' },
    { name: 'Support', icon: Headphones, text: 'Manage customer issues, ticket ownership, and resolutions with a shared communication history.' },
];

const comparison = [
    ['A customer order', 'Retyped into the stock sheet, then again into the invoice.', 'Entered once. Stock and finance pick it up from there.'],
    ['Stock levels', 'Whoever counted last has the right number.', 'Sales and purchasing see what is on hand and what is already promised.'],
    ['Month-end reports', 'Someone pulls figures from four places and hopes they agree.', 'Reports read from the same records the team works in all month.'],
];

const roles = [
    ['If you run finance', 'Invoices, supplier bills, and payments sit next to each other, so you can see what is owed and what has come in.'],
    ['If you run the warehouse', 'Receipts, transfers, and reorder levels are visible to the people who sell and buy the stock.'],
    ['If you look after sales', 'Quotations, orders, and follow-ups stay in one place, so the next person knows what was agreed.'],
    ['If you look after people', 'Employee records, leave, attendance, and hiring numbers live in one workspace instead of several files.'],
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
        answer: 'The planned scope covers procurement, selling with POS and detailed invoicing, CRM, accounting, stock, manufacturing, projects, quality, support, and people and HR. Final features and availability will be confirmed as development progresses.',
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
    selling: {
        src: '/images/algosuite/selling.png',
        width: 1612,
        height: 1010,
        alt: 'Item catalogue with mobile phone images, product names, item codes, and filters',
    },
    people: {
        src: '/images/algosuite/people-hr.png',
        width: 1611,
        height: 945,
        alt: 'AlgoSuite Recruitment Dashboard showing applicants, acceptance rate, time to fill, applicant sources, and application status',
    },
};

type Shot = keyof typeof screenshots;
type Feature = { icon: LucideIcon; title: string; text: string };
type Area = {
    id: string;
    label: string;
    icon: LucideIcon;
    title: string;
    description: string;
    highlights: string[];
    shot?: Shot;
    items: Feature[];
    callout: { title: string; text: string };
};

const areas: Area[] = [
    {
        id: 'accounting',
        label: 'Accounting',
        icon: CircleDollarSign,
        shot: 'finance',
        title: 'Know where your business stands.',
        description:
            'Bring invoices, bills, and payments into the same conversation. Give your finance team the context behind the numbers, without chasing updates from every department.',
        highlights: [
            'Customer invoices and supplier bills',
            'Receivables, payables, and expense tracking',
            'Reports built on shared records',
        ],
        items: [
            { icon: FileText, title: 'Invoices and bills', text: 'Raise customer invoices and record supplier bills against the same customer and supplier records. Amount due and payment status stay with each document.' },
            { icon: Wallet, title: 'Payments in and out', text: 'See money received and money paid beside the bills they settle, so the next payment decision has context.' },
            { icon: Scale, title: 'Receivables and payables', text: 'Track who owes you and what you owe, with outstanding balances visible without a separate ledger sheet.' },
            { icon: BarChart3, title: 'Profit and loss', text: 'Read income and expenses side by side with net profit or loss for the period you pick.' },
            { icon: Landmark, title: 'Chart of accounts', text: 'Organise the records behind the numbers, so each figure maps to an account you can trace.' },
            { icon: ArrowLeftRight, title: 'Invoice trends', text: 'Compare monthly sales and purchase invoices over time to spot seasonality and slow payers.' },
        ],
        callout: {
            title: 'Follow the transaction, not another spreadsheet.',
            text: 'A customer order becomes an invoice. A supplier bill creates an amount to pay. Payments and expenses feed the financial picture, and every number traces back to the work behind it.',
        },
    },
    {
        id: 'financial',
        label: 'Financial management',
        icon: Landmark,
        title: 'Run the numbers with a calmer month-end.',
        description:
            'Go beyond recording transactions. Plan cash, control spending, and close each period from records that already agree with each other.',
        highlights: ['Cash flow visibility', 'Budgets against actual spend', 'A repeatable period close'],
        items: [
            { icon: Wallet, title: 'Cash flow', text: 'See expected receipts and payments together so you know how much cash you will have, and when.' },
            { icon: Scale, title: 'Budgets', text: 'Set budgets by account or department and compare them with what has actually been spent.' },
            { icon: Receipt, title: 'Expense tracking', text: 'Record and categorise expenses as they happen rather than rebuilding them at month-end.' },
            { icon: ClipboardList, title: 'Period close', text: 'Work through a checklist of reconciliations and reviews so every close follows the same steps.' },
            { icon: FileText, title: 'Financial statements', text: 'Produce balance sheet and profit and loss views straight from the ledger.' },
            { icon: ShieldCheck, title: 'Audit trail', text: 'Keep a record of who changed what and when, so questions from auditors have quick answers.' },
        ],
        callout: {
            title: 'Fewer surprises at the end of the month.',
            text: 'When operations post into the ledger as work happens, closing the books means reviewing figures, not collecting them.',
        },
    },
    {
        id: 'global',
        label: 'Global business',
        icon: Globe,
        title: 'Work across currencies, companies, and countries.',
        description:
            'If you trade across borders or run more than one entity, the system should handle it natively instead of through side spreadsheets.',
        highlights: ['Multiple currencies', 'More than one company', 'Local tax rules'],
        items: [
            { icon: Coins, title: 'Multi-currency', text: 'Quote, invoice, and pay in different currencies, with exchange rates recorded against each transaction.' },
            { icon: Building2, title: 'Multiple companies', text: 'Keep separate entities in one system, each with its own books and a shared set of master records.' },
            { icon: Landmark, title: 'Tax handling', text: 'Apply tax rules by region and product so invoices carry the right amounts.' },
            { icon: Languages, title: 'Language and region', text: 'Let teams in different places work in the language and formats they use daily.' },
            { icon: ArrowLeftRight, title: 'Inter-company activity', text: 'Record sales and transfers between your own entities and keep both sides in step.' },
            { icon: Scale, title: 'Consolidated view', text: 'Bring results from several entities together for one group-level picture.' },
        ],
        callout: {
            title: 'Growth should not mean a new set of spreadsheets.',
            text: 'We design for multiple currencies and entities from the start, so expanding does not force a rebuild.',
        },
    },
    {
        id: 'performance',
        label: 'Performance management',
        icon: Target,
        title: 'Measure what matters, from live records.',
        description:
            'Turn the data your teams already enter into targets, scorecards, and forecasts, so reviews start from facts rather than from whoever built the slide.',
        highlights: ['KPIs on live data', 'Budget against actual', 'Forecasts you can adjust'],
        items: [
            { icon: Target, title: 'KPIs and targets', text: 'Define the measures that matter to each team and track them against targets over time.' },
            { icon: BarChart3, title: 'Dashboards', text: 'Give each role a view built from the same shared records, rather than a monthly export.' },
            { icon: Scale, title: 'Budget vs actual', text: 'Compare plans with results by account, department, or project and see where they diverge.' },
            { icon: TrendingUp, title: 'Forecasting', text: 'Project revenue and spend from current trends, then adjust the assumptions.' },
            { icon: ClipboardList, title: 'Planning cycles', text: 'Run budget and planning rounds with owners, deadlines, and approvals in one place.' },
            { icon: FileText, title: 'Management reports', text: 'Build recurring reports once and refresh them as the data changes.' },
        ],
        callout: {
            title: 'Reports that match the books.',
            text: 'Because performance figures read from the same records as finance and operations, the numbers in a review meeting agree with everyone else’s.',
        },
    },
    {
        id: 'inventory',
        label: 'Inventory management',
        icon: Boxes,
        shot: 'inventory',
        title: 'Keep stock moving. Keep everyone informed.',
        description:
            'See what is available, what is committed, and what needs replenishing. Connect the warehouse with purchasing and sales so teams work from the same stock records.',
        highlights: [
            'Item records and warehouse visibility',
            'Receipts, transfers, and adjustments',
            'Reorder planning with purchasing context',
        ],
        items: [
            { icon: Boxes, title: 'Item records', text: 'Keep one record per item, with the details purchasing, sales, and the warehouse all rely on.' },
            { icon: Warehouse, title: 'Multiple warehouses', text: 'Hold stock across locations and see what sits where, instead of reconciling separate counts.' },
            { icon: ArrowLeftRight, title: 'Receipts and transfers', text: 'Record purchase receipts, move stock between warehouses, and post adjustments with a clear history.' },
            { icon: Scale, title: 'Stock valuation', text: 'See what your stock is worth, so finance and the warehouse look at the same figure.' },
            { icon: BarChart3, title: 'Delivery trends', text: 'Follow what leaves the warehouse over time and plan around busy and quiet periods.' },
            { icon: PackageCheck, title: 'Reorder planning', text: 'Know which items are running low and give purchasing the context to reorder in time.' },
        ],
        callout: {
            title: 'One stock record for everyone who touches it.',
            text: 'When purchasing, the warehouse, and sales read from the same item records, nobody promises stock that is already spoken for.',
        },
    },
    {
        id: 'orders',
        label: 'Order management',
        icon: ShoppingBag,
        title: 'From quotation to delivered order without retyping.',
        description:
            'Keep what was agreed with the customer attached to the order, and let stock, delivery, and invoicing pick it up from there.',
        highlights: ['Quotations and sales orders', 'Order status in one place', 'Delivery and invoicing handoff'],
        items: [
            { icon: FileText, title: 'Quotations', text: 'Prepare quotations from your item and price records and convert accepted ones into orders.' },
            { icon: ShoppingBag, title: 'Sales orders', text: 'Capture customer, items, prices, and delivery terms once, and carry them through the order.' },
            { icon: Boxes, title: 'Stock availability', text: 'Check what is on hand while taking the order, so you promise what you can deliver.' },
            { icon: Truck, title: 'Fulfilment', text: 'Hand orders to the warehouse with the context needed to pick, pack, and dispatch.' },
            { icon: Receipt, title: 'Invoicing', text: 'Raise invoices from delivered orders, so billing matches what was actually sent.' },
            { icon: RotateCcw, title: 'Returns', text: 'Record returns against the original order and keep stock and credit notes in line.' },
        ],
        callout: {
            title: 'Anyone can see where an order stands.',
            text: 'Sales, the warehouse, and finance look at the same order, so status questions do not need a phone call.',
        },
    },
    {
        id: 'supply-chain',
        label: 'Supply chain management',
        icon: Truck,
        title: 'See the whole route from supplier to customer.',
        description:
            'Connect what you buy, what you hold, and what you ship, so planning is based on the whole picture rather than one team’s view.',
        highlights: ['Demand and replenishment planning', 'Supplier lead times', 'Stock in transit'],
        items: [
            { icon: TrendingUp, title: 'Demand planning', text: 'Use past sales and open orders to estimate what you will need and when.' },
            { icon: PackageCheck, title: 'Replenishment', text: 'Turn reorder levels and demand into suggested purchases for the buyer to review.' },
            { icon: Clock, title: 'Supplier lead times', text: 'Record how long each supplier really takes, and plan orders around it.' },
            { icon: Truck, title: 'Stock in transit', text: 'Track goods between suppliers, warehouses, and customers so nothing disappears between steps.' },
            { icon: Warehouse, title: 'Multi-location flow', text: 'Move stock between sites with the transfer recorded on both ends.' },
            { icon: BarChart3, title: 'Supply reporting', text: 'Review supplier performance, delays, and stock cover in one set of reports.' },
        ],
        callout: {
            title: 'Plan from the whole picture.',
            text: 'Buyers see sales demand, the warehouse sees incoming goods, and finance sees what is committed.',
        },
    },
    {
        id: 'warehouse',
        label: 'Warehouse management',
        icon: Warehouse,
        title: 'Give the warehouse a clear next task.',
        description:
            'Organise locations and the day-to-day work of receiving, picking, and dispatching, with the same stock records the rest of the business uses.',
        highlights: ['Bins and locations', 'Pick, pack, and dispatch', 'Barcode scanning'],
        items: [
            { icon: Warehouse, title: 'Locations and bins', text: 'Describe the layout of your warehouse so stock has a known place.' },
            { icon: PackageCheck, title: 'Receiving and putaway', text: 'Receive against purchase orders and direct goods to the right location.' },
            { icon: ClipboardList, title: 'Picking and packing', text: 'Give staff pick lists built from open orders, in a sensible order.' },
            { icon: ScanBarcode, title: 'Barcode scanning', text: 'Scan items and locations to cut keying mistakes during receiving and picking.' },
            { icon: Check, title: 'Cycle counts', text: 'Count part of the warehouse at a time and post differences with a reason.' },
            { icon: Truck, title: 'Dispatch', text: 'Confirm what left, for whom, and hand the details on to invoicing.' },
        ],
        callout: {
            title: 'Fewer clipboards, fewer mistakes.',
            text: 'Warehouse work updates the same stock records that sales and purchasing check, as it happens.',
        },
    },
    {
        id: 'procurement',
        label: 'Procurement',
        icon: ShoppingCart,
        title: 'Buy with approvals and a paper trail.',
        description:
            'Connect purchase requests, supplier quotations, orders, and receipts, so spending is approved before it happens and matched when goods arrive.',
        highlights: ['Purchase requests and approvals', 'Supplier quotations', 'Receipts matched to orders'],
        items: [
            { icon: ClipboardList, title: 'Purchase requests', text: 'Let teams request what they need, with the right person approving before an order goes out.' },
            { icon: FileText, title: 'Supplier quotations', text: 'Collect quotes from several suppliers and compare them side by side.' },
            { icon: ShoppingCart, title: 'Purchase orders', text: 'Turn approved requests into orders with agreed prices and delivery dates.' },
            { icon: PackageCheck, title: 'Goods receipts', text: 'Record what actually arrived and match it to the order.' },
            { icon: Users, title: 'Supplier records', text: 'Keep contacts, terms, and purchase history for every supplier in one place.' },
            { icon: Receipt, title: 'Bill matching', text: 'Check supplier bills against the order and receipt before they are paid.' },
        ],
        callout: {
            title: 'Know what was ordered, received, and owed.',
            text: 'Orders, receipts, and bills link to each other, so finance can pay with confidence.',
        },
    },
    {
        id: 'selling',
        label: 'Selling',
        icon: ShoppingBag,
        shot: 'selling',
        title: 'Connect every sale, from checkout to payment.',
        description:
            'Manage counter sales and customer orders in one selling workspace. Bring POS checkout, detailed invoices, and payment tracking together with the stock and accounting records your team already uses.',
        highlights: ['Point of sale (POS) checkout', 'Detailed invoices with taxes and discounts', 'Payments, returns, and customer balances'],
        items: [
            { icon: Receipt, title: 'Point of sale (POS)', text: 'Build a cart, select a customer, apply discounts, and record cash or card payments. Issue a receipt and connect each checkout to stock and accounting.' },
            { icon: ScanBarcode, title: 'Fast item entry', text: 'Find items by name or barcode and review quantities, prices, and availability while preparing a sale.' },
            { icon: FileText, title: 'Detailed invoicing', text: 'Prepare itemised invoices with customer details, quantities, unit prices, discounts, taxes, and totals. Carry order details into billing and include payment terms and due dates.' },
            { icon: ShoppingBag, title: 'Quotations and sales orders', text: 'Prepare quotations, convert accepted quotes into sales orders, and keep agreed prices and delivery terms attached through invoicing.' },
            { icon: Wallet, title: 'Payments and outstanding balances', text: 'Record full or partial payments against invoices, review unpaid amounts, and follow customer balances and overdue bills.' },
            { icon: RotateCcw, title: 'Returns and credit notes', text: 'Link returns and credit notes to the original sale, with the related stock changes and customer balance kept together.' },
        ],
        callout: {
            title: 'One sale, connected across the business.',
            text: 'POS receipts and sales invoices carry the same customer and item details into stock and accounting, so your teams can follow what was sold, billed, and paid.',
        },
    },
    {
        id: 'people',
        label: 'People & HR',
        icon: Users,
        shot: 'people',
        title: 'Less paperwork between you and your people.',
        description:
            'Organise employee information and everyday HR tasks in one place, so people teams spend less time piecing records together.',
        highlights: [
            'Central employee records',
            'Attendance and leave workflows',
            'Recruitment and hiring metrics',
        ],
        items: [
            { icon: Users, title: 'Employee records', text: 'Keep contracts, roles, and contact details in one place instead of scattered folders.' },
            { icon: CalendarCheck, title: 'Attendance and leave', text: 'Staff request leave, managers approve it, and attendance lands in the same record.' },
            { icon: Wallet, title: 'Payroll preparation', text: 'Gather attendance and leave into the figures your payroll run needs.' },
            { icon: UserPlus, title: 'Recruitment', text: 'Follow applicants from first application to offer, with the status of every opening visible.' },
            { icon: BarChart3, title: 'Hiring metrics', text: 'Track applicant sources, acceptance rate, and time to fill to see which channels work.' },
            { icon: FileText, title: 'People reporting', text: 'Answer headcount and absence questions without building a report by hand.' },
        ],
        callout: {
            title: 'One set of employee records.',
            text: 'Starters, leave, and hiring all update the same records, so HR spends its time on people, not on matching files.',
        },
    },
];

function WorkspacePreview({ shot, sidebar = false }: { shot: Shot; sidebar?: boolean }) {
    const screenshot = screenshots[shot];
    return (
        <a
            href={screenshot.src}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open full-size image: ${screenshot.alt}`}
            className="group block overflow-hidden rounded-lg border border-border bg-card shadow-xl shadow-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-4"
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
const eyebrow = 'text-sm font-medium text-primary';
const heading =
    'mt-4 text-3xl font-semibold leading-tight tracking-tight md:text-5xl';
const container = 'site-container';
const section = 'site-section';

export const MainContent = () => (
    <main>
        <section
            id="overview"
            className="scroll-mt-24 bg-muted px-4 pb-16 pt-32 md:px-6 md:pb-20 md:pt-40"
        >
            <div className={container}>
                {}
                <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.08fr] lg:gap-16">
                    <div>
                        {}
                        <h1 className="max-w-xl text-4xl leading-none tracking-tighter sm:text-6xl xl:text-7xl">
                            Your whole business.
                            <br />
                            <span className="text-primary">
                                Working together.
                            </span>
                        </h1>
                        <p className="mt-7 max-w-lg text-sm leading-relaxed text-foreground/70">
                            AlgoSuite is business software we are building at
                            UnityAlgo. Orders, stock, invoices, and your team&apos;s
                            records live in one system, so nobody retypes
                            anything.
                        </p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <Button asChild size="lg" className="py-2 px-6">
                                <Link href="#contact" className='text-sm'>
                                    Talk to us{' '}
                                    <ArrowUpRight className="size-4" />
                                </Link>
                            </Button>
                            <Button
                                asChild
                                variant="outline"
                                size="lg"
                                className="py-2 px-6"
                            >
                                <Link href="#modules" className='text-sm'>
                                    See the modules{' '}
                                    <ArrowDown className="size-4" />
                                </Link>
                            </Button>
                        </div>
                        <p className="mt-5 text-sm text-muted-foreground">
                            AlgoSuite is still in development. Talk to us and
                            we will tell you honestly where it stands.
                        </p>
                    </div>
                    <div className="min-w-0">
                        <WorkspacePreview shot="workspace" sidebar />
                        <p className="mt-4 text-xs text-muted-foreground">
                            The AlgoSuite home workspace, from a preview build.
                        </p>
                    </div>
                </div>
            </div>
        </section>

        <nav
            aria-label="AlgoSuite page sections"
            className="border-y border-border px-4 md:px-6"
        >
            <div
                className={`${container} flex items-center gap-gap-xl overflow-x-auto py-5 text-sm`}
            >
                <span className="hidden shrink-0 border-r border-border pr-8 font-semibold sm:block">
                    AlgoSuite
                </span>
                {[
                    ['Overview', 'overview'],
                    ['What is ERP', 'what-is-erp'],
                    ['Modules', 'modules'],
                    ['By role', 'roles'],
                    ['How it connects', 'workflow'],
                    ['Industries', 'industries'],
                    ['Implementation', 'implementation'],
                    ['FAQs', 'faqs'],
                ].map(([label, id]) => (
                    <a
                        key={id}
                        href={`#${id}`}
                        className="shrink-0 text-foreground/70 hover:text-foreground active:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4"
                    >
                        {label}
                    </a>
                ))}
            </div>
        </nav>

        <section id="what-is-erp" className={section}>
            <div className={container}>
                <div className="grid gap-10 md:grid-cols-[0.65fr_1fr]">
                    <h2 className="text-3xl leading-tight tracking-tight md:text-4xl">
                        What an ERP actually changes
                    </h2>
                    <div>
                        <p className="max-w-2xl text-lg leading-relaxed text-foreground/70">
                            ERP stands for enterprise resource planning. In
                            practice it means finance, stock, sales, and HR
                            share one database instead of each keeping their
                            own. Here is what that looks like day to day.
                        </p>
                        <dl className="mt-10 divide-y divide-border border-y border-border">
                            {comparison.map(([topic, before, after]) => (
                                <div key={topic} className="grid gap-2 py-6 sm:grid-cols-[calc(var(--spacing)*40)_1fr_1fr] sm:gap-gap-xl">
                                    <dt className="font-semibold">{topic}</dt>
                                    <dd className="text-sm leading-7 text-muted-foreground">Today: {before}</dd>
                                    <dd className="text-sm leading-7 text-foreground">With AlgoSuite: {after}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                </div>
            </div>
        </section>

        <section className={section}>
            <div className={container}>
                <div className="grid gap-gap-xl md:grid-cols-[0.65fr_1fr]">
                    <p className={eyebrow}>Why we are building it</p>
                    <div>
                        <h2 className="text-3xl leading-tight tracking-tight md:text-5xl">
                            Your teams already depend on each other. The software usually does not.
                        </h2>
                        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-foreground/70">
                            A single sale touches stock, cash, and someone&apos;s
                            to-do list. When each lives in a different tool,
                            people fill the gaps by hand. AlgoSuite starts with
                            those gaps.
                        </p>
                    </div>
                </div>
                <div className="mt-14 grid gap-gap-xl border-t border-border pt-8 md:grid-cols-3">
                    {[
                        [
                            'One record, many teams',
                            'Keep the customer, item, and transaction records behind your work together, so each team can see the same story.',
                        ],
                        [
                            'Less copying between files',
                            'Plan workflows that carry information between departments, instead of copying it into another spreadsheet.',
                        ],
                        [
                            'A wider view',
                            'Bring operational and financial context together to help people make better-informed decisions.',
                        ],
                    ].map(([title, text]) => (
                        <div key={title}>
                            <h3 className="text-xl ">
                                {title}
                            </h3>
                            <p className="mt-3 text-sm leading-7 text-foreground/70">
                                {text}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>

        <section id="modules" className={`${section} bg-muted`}>
            <div className={container}>
                <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
                    <div>
                        <h2 className={heading}>Modules we provide.</h2>
                    </div>
                    <p className="max-w-sm text-sm leading-6 text-foreground/70">
                        Pick the part of the business you care about most. Scope
                        and availability are not final.
                    </p>
                </div>
                <div className="mb-12 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                    {plannedModules.map((module) => (
                        <a
                            key={module.name}
                            href="#contact"
                            className="group flex flex-col rounded-sm border border-border bg-card p-7 transition-colors hover:border-input hover:bg-muted active:border-muted-foreground active:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                        >
                            <module.icon className="size-7 text-foreground/70" />
                            <h3 className="mt-6 text-xl tracking-tight group-active:text-foreground">{module.name}</h3>
                            <p className="mt-4 flex-1 text-sm leading-7 text-foreground/70">{module.text}</p>
                            <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-foreground/80 group-hover:text-foreground">Ask about {module.name} <ArrowUpRight className="size-4" /></span>
                        </a>
                    ))}
                    <div className="flex flex-col justify-center rounded-sm border border-border bg-secondary p-7">
                        <ClipboardList className="size-7 text-foreground/70" />
                        <h3 className="mt-6 text-xl ">Planned around your team</h3>
                        <p className="mt-4 text-sm leading-7 text-foreground/70">People &amp; HR is also part of the planned suite. Final module scope and availability will be confirmed as development progresses.</p>
                    </div>
                </div>
                <div className="mb-8 max-w-2xl">
                    <h3 className="text-3xl tracking-tight md:text-4xl">Features by area of the business</h3>
                    <p className="mt-4 text-base leading-7 text-foreground/70">Choose an area to see what we are planning to cover. Screenshots come from preview builds and may change.</p>
                </div>
                <Tabs defaultValue="accounting" orientation="vertical" className="gap-gap-xl lg:grid lg:grid-cols-[var(--panel-w)_1fr] lg:gap-12">
                    <TabsList
                        aria-label="Feature areas"
                        className="h-auto w-full flex-row justify-start gap-1 overflow-x-auto rounded-none border-b border-border bg-transparent p-0 lg:sticky lg:top-28 lg:flex-col lg:items-stretch lg:gap-0 lg:self-start lg:border-b-0 lg:border-l"
                    >
                        {areas.map((area) => (
                            <TabsTrigger
                                key={area.id}
                                value={area.id}
                                className="h-auto flex-none justify-start whitespace-nowrap rounded-none border-0 border-b-2 border-transparent px-3 py-3 text-left text-sm font-medium text-foreground/70 hover:bg-secondary hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none lg:-ml-px lg:whitespace-normal lg:border-b-0 lg:border-l-2 lg:px-5 lg:py-3.5"
                            >
                                {area.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    <div className="min-w-0">
                        {areas.map((area) => (
                            <TabsContent key={area.id} value={area.id}>
                                <div className={`grid items-start gap-gap-xl ${area.shot ? 'xl:grid-cols-[1fr_0.9fr] xl:gap-12' : ''}`}>
                                    <div>
                                        <h3 className="max-w-lg text-3xl leading-tight tracking-tight">
                                            {area.title}
                                        </h3>
                                        <p className="mt-4 max-w-xl text-base leading-7 text-foreground/70">
                                            {area.description}
                                        </p>
                                        <ul className="mt-5 space-y-2.5">
                                            {area.highlights.map((h) => (
                                                <li key={h} className="flex items-start gap-3 text-sm text-foreground/80">
                                                    <Check className="mt-0.5 size-4 shrink-0 text-foreground/70" />
                                                    {h}
                                                </li>
                                            ))}
                                        </ul>
                                        <a
                                            href="#contact"
                                            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-foreground/70 hover:text-foreground hover:underline"
                                        >
                                            Ask about {area.label.toLowerCase()} <ArrowRight className="size-4" />
                                        </a>
                                    </div>
                                    {area.shot && (
                                        <div className="min-w-0">
                                            <WorkspacePreview shot={area.shot} />
                                            <p className="mt-3 text-xs leading-6 text-muted-foreground">
                                                From a preview build. Select to enlarge.
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-10 grid gap-x-gap-xl gap-y-9 border-t border-border pt-9 sm:grid-cols-2">
                                    {area.items.map((item) => (
                                        <article key={item.title}>
                                            <item.icon className="size-6 text-foreground/70" />
                                            <h4 className="mt-3 text-lg ">{item.title}</h4>
                                            <p className="mt-2 text-sm leading-7 text-foreground/70">{item.text}</p>
                                        </article>
                                    ))}
                                </div>
                                <div className="mt-10 border-l-2 border-primary bg-card p-6">
                                    <h4 className="">{area.callout.title}</h4>
                                    <p className="mt-2 max-w-3xl text-sm leading-7 text-foreground/70">{area.callout.text}</p>
                                </div>
                            </TabsContent>
                        ))}
                    </div>
                </Tabs>
            </div>
        </section>

        <section id="roles" className={section}>
            <div className={container}>
                <div className="grid gap-10 md:grid-cols-[0.65fr_1fr]">
                    <h2 className="text-3xl leading-tight tracking-tight md:text-4xl">
                        What it means for your role
                    </h2>
                    <dl className="divide-y divide-border border-y border-border">
                        {roles.map(([role, text]) => (
                            <div key={role} className="grid gap-2 py-6 sm:grid-cols-[calc(var(--spacing)*48)_1fr] sm:gap-gap-xl">
                                <dt className="font-semibold">{role}</dt>
                                <dd className="text-sm leading-7 text-foreground/70">{text}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </div>
        </section>

        <section id="workflow" className={`${section} bg-primary text-primary-foreground`}>
            <div className={container}>
                <div className="grid gap-gap-lg md:grid-cols-2">
                    <div>
                        <h2 className={heading}>
                            Follow one order
                            <br />through the company
                        </h2>
                    </div>
                    <p className="max-w-lg self-end text-base leading-7 text-primary-foreground/80">
                        This is the everyday workflow we are designing around.
                        Each team does its part, and the order details travel
                        with the work.
                    </p>
                </div>
                <ol className="mt-14 grid md:grid-cols-4">
                    {workflow.map((step, index) => (
                        <li
                            key={step.label}
                            className="relative border-t border-primary-foreground/20 py-8 pr-6 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0"
                        >
                            <div className="flex justify-between">
                                <step.icon className="size-6 text-primary-foreground/80" />
                                <span className="font-mono text-xs text-primary-foreground/80">
                                    0{index + 1}
                                </span>
                            </div>
                            <p className="mt-8 text-sm text-primary-foreground/80">
                                {step.label}
                            </p>
                            <h3 className="mt-3 text-xl ">
                                {step.title}
                            </h3>
                            <p className="mt-3 text-sm leading-7 text-primary-foreground/80">
                                {step.text}
                            </p>
                            {index < 3 && (
                                <ArrowRight className="absolute -right-3 top-12 hidden size-5 bg-primary text-muted-foreground/50 md:block" />
                            )}
                        </li>
                    ))}
                </ol>
                <p className="border-t border-primary-foreground/20 pt-6 text-sm leading-6 text-primary-foreground/80">
                    The aim is simple: anyone can see where an order is, from the
                    first call to the final payment.
                </p>
            </div>
        </section>

        <section id="industries" className={section}>
            <div className={container}>
                <h2 className={`${heading} max-w-2xl`}>
                    Who it is for
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-7 text-foreground/70">
                    These are the kinds of business we are shaping AlgoSuite
                    around. If yours is different, tell us.
                </p>
                <div className="mt-12 grid gap-2 md:grid-cols-3">
                    {industries.map((industry) => (
                        <article
                            key={industry.title}
                            className="flex flex-col border rounded-sm border-border p-4 transition-colors hover:border-input hover:bg-muted focus-within:border-input focus-within:bg-muted"
                        >
                            <industry.icon className="size-7 text-foreground/70" />
                            <h3 className="mt-7 text-2xl tracking-tight">
                                {industry.title}
                            </h3>
                            <p className="mt-4 flex-1 text-sm leading-7 text-foreground/70">
                                {industry.text}
                            </p>
                            <a
                                href="#contact"
                                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-foreground/80 hover:text-foreground active:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                            >
                                Talk about your business{' '}
                                <ArrowUpRight className="size-4" />
                            </a>
                        </article>
                    ))}
                </div>
            </div>
        </section>

        <section className="border-y border-border bg-muted">
            <div className="mx-auto grid max-w-site lg:grid-cols-2">
                <div className="relative min-h-72 lg:min-h-115">
                    <Image
                        src="/images/services/software-development.jpg"
                        alt="A software team collaborating around a table of laptops"
                        fill
                        sizes="(min-width: 1024px) 50vw, 100vw"
                        className="object-cover"
                    />
                </div>
                <div className="px-6 py-12 md:p-14 lg:p-16">
                    <h2 className="text-3xl tracking-tight md:text-4xl">
                        We build business software for a living
                    </h2>
                    <p className="mt-6 text-base leading-7 text-foreground/70">
                        UnityAlgo writes custom software and implements ERP for
                        clients. AlgoSuite comes out of that work: the same
                        questions keep coming up about who needs which
                        information, what happens next, and where a process
                        gets stuck.
                    </p>
                    <p className="mt-7 border-t border-border pt-6 text-sm leading-7 text-foreground/70">
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
                <div className="grid gap-gap-lg md:grid-cols-2">
                    <div>
                        <h2 className={heading}>
                            How a rollout would work
                        </h2>
                    </div>
                    <p className="max-w-lg self-end text-base leading-7 text-foreground/70">
                        A new system changes how people work, not just which
                        screen they use. This is the order we would suggest.
                    </p>
                </div>
                <div className="mt-12 grid gap-gap-xl sm:grid-cols-2 lg:grid-cols-4">
                    {rollout.map((step, index) => (
                        <div
                            key={step.title}
                            className="border-t border-input pt-5"
                        >
                            <span className="font-mono text-sm text-primary">
                                0{index + 1}
                            </span>
                            <h3 className="mt-6 text-xl ">
                                {step.title}
                            </h3>
                            <p className="mt-3 text-sm leading-7 text-foreground/70">
                                {step.text}
                            </p>
                        </div>
                    ))}
                </div>
                <div className="mt-12 flex flex-col justify-between gap-gap border-l-2 border-primary bg-muted p-6 sm:flex-row sm:items-center">
                    <p className="text-sm leading-6 text-foreground/70">
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

        <section id="faqs" className={`${section} border-t border-border`}>
            <div
                className={`${container} grid gap-10 lg:grid-cols-[0.7fr_1fr]`}
            >
                <div>
                    <h2 className="text-3xl tracking-tight md:text-4xl">
                        Questions we get
                    </h2>
                    {}
                </div>
                <Accordion type="single" collapsible>
                    {questions.map((item, index) => (
                        <AccordionItem
                            key={item.question}
                            value={`question-${index}`}
                            className="border-border"
                        >
                            <AccordionTrigger className="py-6 pr-2 text-base">
                                {item.question}
                            </AccordionTrigger>
                            <AccordionContent className="max-w-2xl pb-6 text-sm leading-7 text-foreground/70">
                                {item.answer}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </section>

        <section id="contact" className={`${section} bg-secondary`}>
            <div
                className={`${container} grid gap-10 md:grid-cols-[1fr_0.7fr] md:items-center`}
            >
                <div>
                    <h2 className="max-w-2xl text-4xl leading-tight tracking-tight md:text-5xl">
                        Tell us how your business runs today
                    </h2>
                    <p className="mt-6 max-w-xl text-base leading-7 text-foreground/70">
                        What tools do you use, where does work get stuck, and
                        what do you need next? We will tell you whether
                        AlgoSuite is a fit or whether something else would
                        serve you better.
                    </p>
                </div>
                <div className="border-l border-input pl-6 md:pl-10">
                    <h3 className="text-xl ">
                        Get in touch
                    </h3>
                    <p className="mt-3 mb-3 text-sm leading-6 text-foreground/70">
                        Ask about modules, availability, or implementation. You
                        do not need a full requirements list.
                    </p>
                    <Button asChild size="lg" className="py-2 px-4">
                        <Link href="/#contact">
                            Contact us <ArrowUpRight className="size-4" />
                        </Link>
                    </Button>
                    <p className="mt-4 text-xs leading-6 text-muted-foreground">
                        AlgoSuite is in development. Launch timing and pricing
                        are to be confirmed.
                    </p>
                </div>
            </div>
        </section>
    </main>
);

