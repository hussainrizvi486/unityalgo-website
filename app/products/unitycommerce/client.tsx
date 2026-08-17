'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
    ArrowRight,
    BarChart3,
    Check,
    CheckCircle2,
    Clock,
    CreditCard,
    Globe2,
    Headphones,
    Heart,
    HelpCircle,
    LayoutTemplate,
    LockKeyhole,
    MessageSquare,
    PackageCheck,
    Palette,
    RotateCcw,
    Search,
    ShieldCheck,
    ShoppingBag,
    Smartphone,
    Sparkles,
    Store,
    TrendingUp,
    Truck,
    UserRound,
    Users,
    Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FaqSection } from '@/components/website/faq-section';
import { cn } from '@/utils';

const includedFeatures = [
    { icon: Store, label: 'One complete online store' },
    { icon: LockKeyhole, label: 'Secure cloud hosting' },
    { icon: CheckCircle2, label: 'Automatic platform updates' },
    { icon: LayoutTemplate, label: '10 professionally designed themes' },
    { icon: Smartphone, label: 'Mobile-responsive storefront' },
    { icon: Palette, label: 'Visual theme editor' },
    { icon: Globe2, label: 'Custom domain support' },
    { icon: ShieldCheck, label: 'Free SSL certificate' },
    { icon: PackageCheck, label: 'Order and customer management' },
    { icon: CreditCard, label: 'No platform transaction fee' },
];

const plans = [
    {
        name: 'Starter',
        monthlyPrice: '3,500',
        annualPrice: '2,800',
        audience: 'For Solo Entrepreneurs',
        features: [
            '1 Staff Account',
            'Full Product Catalog',
            '10 Included Themes',
            'Basic Sales & Inventory Reports',
            'Free SSL & Custom Domain Support',
            'Standard Email Support',
        ],
    },
    {
        name: 'Growth',
        monthlyPrice: '7,000',
        annualPrice: '5,600',
        audience: 'For Growing Online Stores',
        features: [
            '5 Staff Accounts',
            'WhatsApp Order Integration',
            'Payment Gateway & COD Support',
            'Point of Sale (POS) Module',
            'Advanced Sales & Inventory Analytics',
            'Priority Customer Support',
        ],
        highlighted: true,
    },
    {
        name: 'Professional',
        monthlyPrice: '42,000',
        annualPrice: '33,600',
        audience: 'For Established Brands',
        features: [
            '15 Staff Accounts',
            'Priority Technical Onboarding',
            'Dedicated Account Manager',
            'Full REST API & Webhook Access',
            'Custom ERP & CRM Integrations',
            'Custom Theme Customization',
            'Custom Analytics Reports',
        ],
    },
    {
        name: 'Enterprise',
        monthlyPrice: '250,000',
        annualPrice: '200,000',
        audience: 'For Large Scale Operations',
        features: [
            'Everything in Professional',
            'Unlimited Staff Accounts',
            'Priority 24/7 Direct Call Support',
            'Fully Customizable Architecture',
            'SLA Guarantee & Dedicated Servers',
        ],
    },
];

const addOns = [
    ['Professional Store Setup', 'PKR 20,000 one-time'],
    ['Product Upload & Catalog Service', 'Starting from PKR 10,000'],
    ['Custom Theme Design & Layout', 'Starting from PKR 40,000'],
    ['Custom Feature Development', 'Quoted separately'],
    ['Additional Staff Accounts', 'PKR 1,000 / account / month'],
    ['Additional Cloud Storage', 'PKR 1,000 / month'],
    ['Priority Migration from Shopify / WooCommerce', 'Starting from PKR 50,000'],
];

const commerceHighlights = [
    { icon: Truck, title: 'Flexible Shipping Rules', text: 'Set nationwide COD & custom rate zones.' },
    { icon: RotateCcw, title: 'Hassle-Free Returns', text: 'Build buyer confidence with smooth policies.' },
    { icon: ShieldCheck, title: 'Encrypted Checkout', text: 'Bank-grade SSL security for every sale.' },
    { icon: Headphones, title: 'Local 24/7 Support', text: 'Direct help when your business needs it.' },
];

const comparisonHighlights = [
    {
        title: 'Platform Transaction Fees',
        unityCommerce: '0% Surcharge (Keep 100% profit)',
        others: '2% to 3.5% fee per sale',
        benefit: 'Save thousands as your sales grow',
    },
    {
        title: 'Local Payments & COD',
        unityCommerce: 'Native Cash on Delivery & Local Gateways',
        others: 'Requires paid plugins & complex setup',
        benefit: 'Ready for regional buyers day one',
    },
    {
        title: 'WhatsApp Commerce',
        unityCommerce: 'Direct WhatsApp Checkout & Chat',
        others: 'Third-party paid extensions only',
        benefit: 'Higher conversion for local traffic',
    },
    {
        title: 'Curated Premium Themes',
        unityCommerce: '10 Themes Included Free',
        others: '$180 - $350 per premium theme',
        benefit: 'Zero extra frontend costs',
    },
];

const faqItems = [
    { question: 'What is Unity Commerce?', answer: 'Unity Commerce is an e-commerce platform that allows businesses to create, customize and manage their own online store. It includes secure hosting, professional themes, a visual theme editor, product management, order management, reports and integrations.' },
    { question: 'Do I need technical knowledge to use Unity Commerce?', answer: 'No. Unity Commerce is designed for small businesses and non-technical users. You can manage products, orders, customers, website content and store design through an easy-to-use dashboard.' },
    { question: 'How many stores can I create?', answer: 'Each Unity Commerce subscription includes one online store. A separate subscription is required for every additional store.' },
    { question: 'Are themes included with every plan?', answer: 'Yes. All plans include access to 10 professionally designed and mobile-responsive themes at no additional cost.' },
    { question: 'Can I customize my store design?', answer: 'Yes. You can customize your store’s colors, fonts, banners, sections and other theme settings through the visual theme editor. Advanced customization, custom CSS, custom components and developer-level changes depend on your selected plan.' },
    { question: 'Can I use my own domain name?', answer: 'Yes. You can connect your existing domain to your Unity Commerce store. Domain registration charges are not included in the subscription.' },
    { question: 'Is hosting included?', answer: 'Yes. Secure cloud hosting, SSL security, platform maintenance and automatic software updates are included with every plan.' },
    { question: 'Does Unity Commerce charge transaction fees?', answer: 'No. Unity Commerce does not charge an additional platform transaction fee on your sales. Your selected payment gateway may charge its own processing or transaction fees.' },
    { question: 'Which payment methods are supported?', answer: 'Unity Commerce can support payment options such as cash on delivery, bank transfer and compatible local payment gateways. Payment-gateway availability and integration may depend on your selected plan and provider.' },
    { question: 'Can I receive orders through WhatsApp?', answer: 'WhatsApp integration is available from the Growth plan. It can help customers contact your business and communicate about products and orders.' },
    { question: 'Can I manage inventory through Unity Commerce?', answer: 'Yes. Unity Commerce allows you to manage products, stock levels, orders and inventory reports through one dashboard.' },
    { question: 'Can multiple team members manage the store?', answer: 'Yes. Starter includes 1 staff account, Growth includes up to 5, Professional includes up to 15, and Enterprise includes unlimited staff accounts. Additional staff accounts may be purchased separately.' },
    { question: 'Does Unity Commerce provide sales reports?', answer: 'Yes. Every plan includes sales and inventory reporting. Growth and Professional plans include more advanced reports and analytics.' },
    { question: 'Can Unity Commerce build custom features for my business?', answer: 'Yes. Custom development is available under the Professional plan or as a separately quoted service. The price and delivery scope depend on the complexity of the requested feature.' },
    { question: 'Can I connect third-party applications?', answer: 'Third-party integrations and API access are available based on the selected plan. The Professional plan is recommended for businesses that require custom integrations or API access.' },
    { question: 'Can you migrate my existing online store?', answer: 'Yes. Unity Commerce can assist with migrating products, customers and other supported store data from another platform. Migration services are priced separately based on the size and complexity of your existing store.' },
    { question: 'Do you provide store setup services?', answer: 'Yes. Professional store setup is available as an optional one-time service. It may include theme configuration, basic store settings and initial website setup.' },
    { question: 'Can you upload products for me?', answer: 'Yes. Product-upload services are available as an optional add-on. Pricing depends on the number of products, variants, images and product information provided.' },
    { question: 'Is customer support included?', answer: 'Yes. Starter includes email support. Growth includes priority support. Professional includes dedicated technical support and priority onboarding.' },
    { question: 'Can I upgrade or downgrade my plan?', answer: 'Yes. You can request to upgrade or downgrade your subscription based on your business requirements. Feature access and billing will be adjusted according to the new plan.' },
    { question: 'Can I cancel my subscription?', answer: 'Yes. Monthly subscriptions can be cancelled at any time. Your store will remain active until the end of the current billing period.' },
    { question: 'Are annual plans cheaper?', answer: 'Yes. Annual subscriptions provide approximately two months of savings compared with monthly billing.' },
    { question: 'What happens if I stop paying for my subscription?', answer: 'Your store may be suspended after the payment due date and any applicable grace period. Customers will not be able to place orders while the store is suspended. Your store data will be retained for a limited period according to Unity Commerce’s data-retention policy.' },
    { question: 'Are domain, SMS and payment-gateway charges included?', answer: 'No. Domain registration, SMS usage, payment-gateway fees, premium third-party services and custom development are billed separately.' },
    { question: 'Is my store secure?', answer: 'Unity Commerce includes SSL security, secure cloud hosting and regular platform updates. Businesses are still responsible for protecting their login credentials and controlling staff access.' },
    { question: 'How long does it take to launch a store?', answer: 'A basic store can be launched quickly once the products, branding, domain and business information are available. Stores requiring data migration, custom design or custom development may require additional implementation time.' },
];

export const MainContent = () => {
    const [isAnnual, setIsAnnual] = useState(false);
    const [activeTab, setActiveTab] = useState<'storefront' | 'checkout' | 'whatsapp' | 'analytics'>('storefront');
    const [showcaseMode, setShowcaseMode] = useState<'desktop' | 'mobile'>('desktop');

    return (
        <main className="relative bg-[#faf9f6] text-ink-950">
            {/* HERO SECTION */}
            <section className="relative isolate overflow-hidden px-4 pb-20 pt-28 sm:pb-28 sm:pt-36">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(140,24,27,0.12),transparent_35%),radial-gradient(circle_at_20%_80%,rgba(240,230,220,0.6),transparent_40%)]" />
                <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-40 [mask-image:linear-gradient(to_bottom,black_40%,transparent_90%)]" />
                
                <div className="container relative mx-auto max-w-7xl">
                    <div className="flex flex-col items-center text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-white/80 px-4 py-2 text-xs font-bold tracking-wide text-brand shadow-sm backdrop-blur-md"
                        >
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
                                <Sparkles className="h-3 w-3" />
                            </span>
                            <span>The Next-Gen Store Builder for Modern Brands</span>
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="mt-6 max-w-4xl text-balance text-4xl font-extrabold leading-[1.05] tracking-[-0.05em] sm:text-6xl lg:text-7xl"
                        >
                            Build an online store that looks <span className="bg-gradient-to-r from-brand via-[#a32226] to-brand bg-clip-text text-transparent">unmistakably yours.</span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="mt-6 max-w-2xl text-balance text-base leading-relaxed text-ink-600 sm:text-xl"
                        >
                            Launch a high-converting storefront, deliver 2-minute checkout experiences, and manage orders, inventory, and WhatsApp sales with zero platform transaction fees.
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                            className="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row"
                        >
                            <Link href="/customer/register?next=/customer/onboarding&plan=Growth" className="w-full sm:w-auto">
                                <Button size="lg" className="group h-13 w-full rounded-full bg-brand px-8 text-base font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:bg-brand/90 hover:shadow-xl hover:shadow-brand/30 sm:w-auto">
                                    Start Building Your Store
                                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </Button>
                            </Link>
                            <Link href="#pricing" className="w-full sm:w-auto">
                                <Button variant="outline" size="lg" className="h-13 w-full rounded-full border-ink-300 bg-white px-8 text-base font-semibold text-ink-800 shadow-sm hover:bg-ink-50 sm:w-auto">
                                    View Pricing & Plans
                                </Button>
                            </Link>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.6, delay: 0.4 }}
                            className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-ink-600 sm:text-sm"
                        >
                            <span className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-brand" />
                                0% Transaction Fees
                            </span>
                            <span className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-brand" />
                                10 Free Premium Themes
                            </span>
                            <span className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-brand" />
                                Mobile & COD Ready
                            </span>
                            <span className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-brand" />
                                Free SSL & Domain Support
                            </span>
                        </motion.div>
                    </div>

                    {/* HERO DUAL DEVICE SHOWCASE */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className="relative mx-auto mt-14 max-w-6xl"
                    >
                        <div className="absolute -inset-4 rounded-[3.5rem] bg-gradient-to-r from-brand/15 via-brand/5 to-brand/15 blur-3xl" />
                        
                        <div className="relative rounded-2xl border border-ink-200/80 bg-white/90 p-2.5 shadow-[0_32px_90px_rgba(21,21,21,0.14)] backdrop-blur-xl sm:p-4 md:rounded-3xl">
                            {/* Browser Header Bar */}
                            <div className="mb-3 flex items-center justify-between border-b border-ink-100 pb-3 px-2">
                                <div className="flex items-center gap-2">
                                    <span className="h-3 w-3 rounded-full bg-red-400" />
                                    <span className="h-3 w-3 rounded-full bg-yellow-400" />
                                    <span className="h-3 w-3 rounded-full bg-green-400" />
                                </div>
                                <div className="flex items-center gap-2 rounded-lg bg-ink-50 px-4 py-1.5 text-xs text-ink-500 font-medium border border-ink-200/60 max-w-sm w-full justify-center">
                                    <LockKeyhole className="h-3 w-3 text-brand" />
                                    <span>https://store.ansa-collections.com</span>
                                </div>
                                <div className="hidden sm:flex items-center gap-2">
                                    <span className="rounded-full bg-success-50 px-2.5 py-1 text-[10px] font-bold text-success-700">Live Demo</span>
                                </div>
                            </div>

                            {/* Main Desktop Image Container */}
                            <div className="relative overflow-hidden rounded-xl border border-ink-100 bg-ink-50 aspect-[16/9.5]">
                                <Image
                                    src="/images/unitycommerce/desktop-storefront.png"
                                    alt="Unity Commerce Desktop Storefront - ANSA Collections"
                                    fill
                                    priority
                                    className="object-cover object-top"
                                />

                                {/* Floating Phone Screenshot Overlay */}
                                <motion.div
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ duration: 0.6, delay: 0.7 }}
                                    className="absolute -bottom-4 right-4 sm:right-8 w-36 sm:w-56 md:w-64 rounded-[1.8rem] sm:rounded-[2.2rem] border-4 sm:border-[6px] border-ink-950 bg-ink-950 shadow-2xl overflow-hidden"
                                >
                                    <div className="relative aspect-[9/18.5] w-full">
                                        <Image
                                            src="/images/unitycommerce/mobile-storefront.png"
                                            alt="Unity Commerce Mobile Storefront"
                                            fill
                                            className="object-cover object-top"
                                        />
                                    </div>
                                </motion.div>

                                {/* Floating Live Sales Badge */}
                                <motion.div
                                    animate={{ y: [0, -6, 0] }}
                                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                                    className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-3 rounded-2xl border border-white/80 bg-white/95 p-3 shadow-xl backdrop-blur-md"
                                >
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-100 text-success-600 shrink-0">
                                        <CheckCircle2 className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Order Completed</p>
                                        <p className="text-xs sm:text-sm font-extrabold text-ink-950">PKR 8,529.40 <span className="text-[10px] font-medium text-success-600">• COD</span></p>
                                    </div>
                                </motion.div>

                                {/* Floating Zero Fee Chip */}
                                <motion.div
                                    animate={{ y: [0, 6, 0] }}
                                    transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                                    className="absolute bottom-6 left-6 hidden sm:flex items-center gap-2.5 rounded-xl border border-brand/20 bg-ink-950/90 px-3.5 py-2.5 text-white shadow-xl backdrop-blur-md"
                                >
                                    <Zap className="h-4 w-4 text-amber-400 fill-amber-400" />
                                    <div className="text-xs">
                                        <p className="font-bold">0% Transaction Fee</p>
                                        <p className="text-[10px] text-ink-300">You keep 100% of your store sales</p>
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    </motion.div>

                    {/* HIGHLIGHT STRIP */}
                    <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 border-t border-ink-200/80 pt-8">
                        {commerceHighlights.map((highlight) => (
                            <div key={highlight.title} className="flex items-center gap-3.5 rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand/15 bg-brand/10 text-brand">
                                    <highlight.icon className="h-5 w-5" />
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

            {/* SHOPIFY-STYLE INTERACTIVE CAPABILITY SHOWCASE */}
            <section className="relative overflow-hidden bg-ink-950 px-4 py-20 text-white sm:py-28">
                <div className="pointer-events-none absolute inset-0 opacity-20 bg-grid-pattern" />
                <div className="container relative mx-auto max-w-7xl">
                    <div className="text-center max-w-3xl mx-auto mb-14">
                        <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand">Engineered for Merchants</span>
                        <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-white sm:text-5xl">
                            Everything you need to sell online &amp; grow.
                        </h2>
                        <p className="mt-4 text-base text-ink-300 sm:text-lg">
                            From your initial product upload to instant mobile checkout, Unity Commerce puts complete operational power in your hands.
                        </p>
                    </div>

                    {/* Interactive Tab Controls */}
                    <div className="flex flex-wrap justify-center gap-2 mb-10">
                        {[
                            { id: 'storefront', label: 'Storefront & Design', icon: LayoutTemplate },
                            { id: 'checkout', label: 'High-Converting Checkout', icon: LockKeyhole },
                            { id: 'whatsapp', label: 'WhatsApp & Customer Chat', icon: MessageSquare },
                            { id: 'analytics', label: 'Order & Inventory Control', icon: BarChart3 },
                        ].map((tab) => {
                            const TabIcon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={cn(
                                        'flex items-center gap-2 rounded-full px-5 py-3 text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer',
                                        isActive
                                            ? 'bg-brand text-white shadow-lg shadow-brand/30'
                                            : 'bg-white/10 text-ink-300 hover:bg-white/15 hover:text-white'
                                    )}
                                >
                                    <TabIcon className="h-4 w-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab Content Panels */}
                    <div className="relative rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-8 backdrop-blur-xl">
                        <AnimatePresence mode="wait">
                            {activeTab === 'storefront' && (
                                <motion.div
                                    key="storefront"
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -15 }}
                                    transition={{ duration: 0.3 }}
                                    className="grid lg:grid-cols-[1fr_1.3fr] gap-8 items-center"
                                >
                                    <div>
                                        <span className="rounded-full bg-brand/20 px-3 py-1 text-[10px] font-bold text-brand uppercase tracking-widest">Store Builder</span>
                                        <h3 className="mt-4 text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                                            A storefront that matches your brand aesthetics.
                                        </h3>
                                        <p className="mt-4 text-sm sm:text-base leading-relaxed text-ink-300">
                                            Customize colors, typography, hero section banners, and product showcase grids without touching code. Pick from 10 included responsive themes.
                                        </p>
                                        <ul className="mt-6 space-y-3 text-sm text-ink-200">
                                            <li className="flex items-center gap-2.5">
                                                <CheckCircle2 className="h-4 w-4 text-brand shrink-0" />
                                                Visual theme editor with live instant preview
                                            </li>
                                            <li className="flex items-center gap-2.5">
                                                <CheckCircle2 className="h-4 w-4 text-brand shrink-0" />
                                                100% mobile-responsive design for smartphone buyers
                                            </li>
                                            <li className="flex items-center gap-2.5">
                                                <CheckCircle2 className="h-4 w-4 text-brand shrink-0" />
                                                Custom domain support with automatic SSL encryption
                                            </li>
                                        </ul>
                                    </div>
                                    <div className="relative overflow-hidden rounded-2xl border border-white/10 aspect-[16/10] bg-ink-900">
                                        <Image
                                            src="/images/unitycommerce/desktop-storefront.png"
                                            alt="Desktop Storefront Preview"
                                            fill
                                            className="object-cover object-top"
                                        />
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'checkout' && (
                                <motion.div
                                    key="checkout"
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -15 }}
                                    transition={{ duration: 0.3 }}
                                    className="grid lg:grid-cols-[1fr_1.3fr] gap-8 items-center"
                                >
                                    <div>
                                        <span className="rounded-full bg-success-500/20 px-3 py-1 text-[10px] font-bold text-success-400 uppercase tracking-widest">Frictionless Checkout</span>
                                        <h3 className="mt-4 text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                                            Turn store visitors into paying buyers.
                                        </h3>
                                        <p className="mt-4 text-sm sm:text-base leading-relaxed text-ink-300">
                                            A clean, 3-step checkout experience built specifically for quick completions. Native Cash on Delivery (COD) and Credit/Debit Card options built-in.
                                        </p>
                                        <ul className="mt-6 space-y-3 text-sm text-ink-200">
                                            <li className="flex items-center gap-2.5">
                                                <CheckCircle2 className="h-4 w-4 text-success-400 shrink-0" />
                                                Clear 3-step progress bar (Info, Shipping, Payment)
                                            </li>
                                            <li className="flex items-center gap-2.5">
                                                <CheckCircle2 className="h-4 w-4 text-success-400 shrink-0" />
                                                Native Cash on Delivery &amp; Credit/Debit Card support
                                            </li>
                                            <li className="flex items-center gap-2.5">
                                                <CheckCircle2 className="h-4 w-4 text-success-400 shrink-0" />
                                                Instant tax, shipping rate, and order total calculations
                                            </li>
                                        </ul>
                                    </div>
                                    <div className="relative overflow-hidden rounded-2xl border border-white/10 aspect-[16/10] bg-ink-900">
                                        <Image
                                            src="/images/unitycommerce/desktop-checkout.png"
                                            alt="Desktop Checkout Preview"
                                            fill
                                            className="object-cover object-top"
                                        />
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'whatsapp' && (
                                <motion.div
                                    key="whatsapp"
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -15 }}
                                    transition={{ duration: 0.3 }}
                                    className="grid lg:grid-cols-[1fr_1.3fr] gap-8 items-center"
                                >
                                    <div>
                                        <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">WhatsApp Direct</span>
                                        <h3 className="mt-4 text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                                            Receive orders straight on WhatsApp.
                                        </h3>
                                        <p className="mt-4 text-sm sm:text-base leading-relaxed text-ink-300">
                                            Connect directly with customers where they spend their time. Enable 1-click WhatsApp order confirmation and pre-filled customer cart details.
                                        </p>
                                        <ul className="mt-6 space-y-3 text-sm text-ink-200">
                                            <li className="flex items-center gap-2.5">
                                                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                                                Instant cart export directly into WhatsApp chat
                                            </li>
                                            <li className="flex items-center gap-2.5">
                                                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                                                Higher conversion rates for regional shoppers
                                            </li>
                                            <li className="flex items-center gap-2.5">
                                                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                                                Available from Growth plan onwards
                                            </li>
                                        </ul>
                                    </div>
                                    <div className="relative overflow-hidden rounded-2xl border border-white/10 aspect-[16/10] bg-ink-900 flex items-center justify-center p-4">
                                        <div className="relative w-48 sm:w-64 aspect-[9/18.5] rounded-3xl border-4 border-ink-800 shadow-2xl overflow-hidden">
                                            <Image
                                                src="/images/unitycommerce/mobile-checkout.png"
                                                alt="Mobile Checkout Preview"
                                                fill
                                                className="object-cover object-top"
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'analytics' && (
                                <motion.div
                                    key="analytics"
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -15 }}
                                    transition={{ duration: 0.3 }}
                                    className="grid lg:grid-cols-[1fr_1.3fr] gap-8 items-center"
                                >
                                    <div>
                                        <span className="rounded-full bg-blue-500/20 px-3 py-1 text-[10px] font-bold text-blue-400 uppercase tracking-widest">Back-Office Control</span>
                                        <h3 className="mt-4 text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                                            Manage orders, stock &amp; team access.
                                        </h3>
                                        <p className="mt-4 text-sm sm:text-base leading-relaxed text-ink-300">
                                            Track incoming store orders, get real-time stock notifications, manage customer details, and grant staff permissions effortlessly.
                                        </p>
                                        <ul className="mt-6 space-y-3 text-sm text-ink-200">
                                            <li className="flex items-center gap-2.5">
                                                <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0" />
                                                Centralized inventory &amp; product catalog manager
                                            </li>
                                            <li className="flex items-center gap-2.5">
                                                <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0" />
                                                Multi-staff account roles (Up to Unlimited on Enterprise)
                                            </li>
                                            <li className="flex items-center gap-2.5">
                                                <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0" />
                                                Sales analytics &amp; performance dashboards
                                            </li>
                                        </ul>
                                    </div>
                                    <div className="relative overflow-hidden rounded-2xl border border-white/10 aspect-[16/10] bg-ink-900 flex items-center justify-center p-6 text-center">
                                        <div className="max-w-md p-6 rounded-2xl bg-white/5 border border-white/10">
                                            <BarChart3 className="h-10 w-10 text-brand mx-auto mb-3" />
                                            <h4 className="text-lg font-bold text-white">Real-Time Business Intelligence</h4>
                                            <p className="mt-2 text-xs text-ink-300">Monitor overall daily revenue, best-selling product items, customer retention, and shipping statuses from your unified dashboard.</p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </section>

            {/* LIVE MERCHANT SHOWCASE SECTION */}
            {/* <section className="bg-white px-4 py-20 sm:py-28">
                <div className="container mx-auto max-w-7xl">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                        <div>
                            <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand">Real Merchant Showcase</span>
                            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-950 sm:text-5xl">
                                Built with Unity Commerce.
                            </h2>
                            <p className="mt-3 max-w-xl text-base text-ink-600">
                                See how brand store <span className="font-bold text-ink-900">ANSA Collections</span> delivers a modern shopping and checkout experience to thousands of customers.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 rounded-full border border-ink-200 bg-ink-50 p-1">
                            <button
                                onClick={() => setShowcaseMode('desktop')}
                                className={cn(
                                    'rounded-full px-4 py-2 text-xs font-bold transition-all cursor-pointer',
                                    showcaseMode === 'desktop' ? 'bg-ink-950 text-white shadow-md' : 'text-ink-600 hover:text-ink-900'
                                )}
                            >
                                Desktop Storefront
                            </button>
                            <button
                                onClick={() => setShowcaseMode('mobile')}
                                className={cn(
                                    'rounded-full px-4 py-2 text-xs font-bold transition-all cursor-pointer',
                                    showcaseMode === 'mobile' ? 'bg-ink-950 text-white shadow-md' : 'text-ink-600 hover:text-ink-900'
                                )}
                            >
                                Mobile Experience
                            </button>
                        </div>
                    </div>

                    <div className="relative overflow-hidden rounded-3xl border border-ink-200 bg-[#fbfaf8] p-4 sm:p-8 shadow-xl">
                        {showcaseMode === 'desktop' ? (
                            <div className="grid lg:grid-cols-2 gap-8 items-center">
                                <div className="relative rounded-2xl overflow-hidden border border-ink-200 aspect-[16/10] bg-white shadow-md">
                                    <Image
                                        src="/images/unitycommerce/desktop-storefront.png"
                                        alt="ANSA Collections Desktop Homepage"
                                        fill
                                        className="object-cover object-top"
                                    />
                                </div>
                                <div className="space-y-6">
                                    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 font-black text-sm">50%</span>
                                            <div>
                                                <h4 className="text-sm font-bold text-ink-950">Promotional Offer Banners</h4>
                                                <p className="text-xs text-ink-500">Run site-wide discount sales, countdown timers, and highlight featured collections effortlessly.</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand font-black text-sm">
                                                <ShoppingBag className="h-4 w-4" />
                                            </span>
                                            <div>
                                                <h4 className="text-sm font-bold text-ink-950">Product Cards &amp; Grid</h4>
                                                <p className="text-xs text-ink-500">Display item tags (Best Sellers, New Season), price formatting, and wishlist icons with quick image load times.</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success-100 text-success-700 font-black text-sm">
                                                <ShieldCheck className="h-4 w-4" />
                                            </span>
                                            <div>
                                                <h4 className="text-sm font-bold text-ink-950">Integrated Checkout</h4>
                                                <p className="text-xs text-ink-500">Seamless transition from product page directly to checkout with auto-calculated subtotal and shipping fees.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="grid lg:grid-cols-2 gap-8 items-center">
                                <div className="flex items-center justify-center">
                                    <div className="relative w-full max-w-sm aspect-[4/7] rounded-[2.5rem] border-[8px] border-ink-950 bg-ink-950 shadow-2xl overflow-hidden">
                                        <Image
                                            src="/images/unitycommerce/mobile-storefront.png"
                                            alt="ANSA Collections Mobile Storefront"
                                            fill
                                            className="object-cover object-top"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm bg-amber-600">
                                        <h4 className="text-sm font-bold text-ink-950 flex items-center gap-2">
                                            <Smartphone className="h-4 w-4 text-brand" /> Mobile-First Navigation
                                        </h4>
                                        <p className="mt-1 text-xs text-ink-500">Includes mobile hamburger navigation, quick cart access, instant search bar, and optimized touch targets for shoppers.</p>
                                    </div>
                                    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
                                        <h4 className="text-sm font-bold text-ink-950 flex items-center gap-2">
                                            <LockKeyhole className="h-4 w-4 text-brand" /> Mobile Checkout Perfection
                                        </h4>
                                        <p className="mt-1 text-xs text-ink-500">Order form fields, delivery option selectors, and single-tap order placement designed specifically for smartphones.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section> */}

            {/* FEATURES LIST SECTION */}
            <section className="py-24 bg-ink-50">
                <div className="container mx-auto px-4 max-w-7xl">
                    <div className="text-center mb-16">
                        <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand">All-Inclusive Platform</span>
                        <h2 className="mt-2 text-3xl font-extrabold text-ink-950 sm:text-4xl">Included With Every Plan</h2>
                        <p className="mt-2 text-ink-600 max-w-2xl mx-auto text-sm sm:text-base">
                            Everything required to launch, host, operate and grow a professional e-commerce store with zero hidden catches.
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {includedFeatures.map((feature, idx) => (
                            <motion.div
                                key={feature.label}
                                initial={{ opacity: 0, y: 15 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: idx * 0.04 }}
                                className="bg-white rounded-2xl border border-ink-100 p-5 hover:border-brand/30 hover:shadow-md transition-all"
                            >
                                <feature.icon className="w-6 h-6 text-brand mb-4" />
                                <p className="text-sm font-bold text-ink-900 leading-snug">{feature.label}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* COMPARISON vs TRADITIONAL BUILDERS */}
            <section className="py-24 bg-white border-t border-ink-100">
                <div className="container mx-auto px-4 max-w-6xl">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand">Why Unity Commerce</span>
                        <h2 className="mt-2 text-3xl font-extrabold text-ink-950 sm:text-4xl">
                            Designed for modern growth vs traditional builders.
                        </h2>
                        <p className="mt-3 text-ink-600 text-sm sm:text-base">
                            Stop losing profit to hidden fees, expensive plugin subscriptions, and complex developer setups.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {comparisonHighlights.map((item) => (
                            <div key={item.title} className="rounded-3xl border border-ink-200 bg-[#fbfaf8] p-6 sm:p-8 flex flex-col justify-between shadow-sm">
                                <div>
                                    <h3 className="text-lg font-bold text-ink-950 mb-4">{item.title}</h3>
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3 rounded-xl bg-success-50 p-3 text-xs sm:text-sm border border-success-100">
                                            <CheckCircle2 className="h-4 w-4 text-success-600 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-bold text-success-900">Unity Commerce: </span>
                                                <span className="text-success-800">{item.unityCommerce}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3 rounded-xl bg-ink-100 p-3 text-xs sm:text-sm border border-ink-200 text-ink-700">
                                            <span className="h-2 w-2 rounded-full bg-ink-400 shrink-0 mt-1.5" />
                                            <div>
                                                <span className="font-bold text-ink-900">Others (Shopify / WP): </span>
                                                <span>{item.others}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <p className="mt-6 text-xs font-bold uppercase tracking-wider text-brand">
                                    💡 Impact: {item.benefit}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* PRICING SECTION */}
            <section id="pricing" className="py-24 bg-[#faf9f6] scroll-mt-20 border-t border-ink-100">
                <div className="container mx-auto px-4 max-w-7xl">
                    <div className="text-center mb-12">
                        <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand">Transparent Pricing</span>
                        <h2 className="mt-2 text-3xl font-extrabold text-ink-950 sm:text-5xl">Simple, predictable pricing plans.</h2>
                        <p className="mt-3 text-ink-600 max-w-2xl mx-auto text-sm sm:text-base">
                            Choose the right subscription for your business scale. No transaction fees ever.
                        </p>

                        {/* Billing Switcher */}
                        <div className="mt-8 flex items-center justify-center gap-3">
                            <span className={cn('text-xs sm:text-sm font-bold', !isAnnual ? 'text-ink-950' : 'text-ink-500')}>Monthly Billing</span>
                            <button
                                onClick={() => setIsAnnual(!isAnnual)}
                                className="relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-ink-950 transition-colors duration-200 ease-in-out"
                            >
                                <span
                                    className={cn(
                                        'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out',
                                        isAnnual ? 'translate-x-6' : 'translate-x-0'
                                    )}
                                />
                            </button>
                            <span className={cn('text-xs sm:text-sm font-bold flex items-center gap-1.5', isAnnual ? 'text-ink-950' : 'text-ink-500')}>
                                Annual Billing
                                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-extrabold text-brand uppercase">Save ~20%</span>
                            </span>
                        </div>
                    </div>

                    {/* Pricing Grid */}
                    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch">
                        {plans.map((plan, idx) => {
                            const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
                            return (
                                <motion.div
                                    key={plan.name}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: idx * 0.08 }}
                                    className={cn(
                                        'rounded-3xl p-7 border transition-all duration-300 flex flex-col justify-between',
                                        plan.highlighted
                                            ? 'bg-brand border-brand text-white shadow-2xl shadow-brand/25 xl:-mt-3 relative z-10'
                                            : 'bg-white border-ink-200 hover:border-brand/30 hover:shadow-xl'
                                    )}
                                >
                                    <div>
                                        {plan.highlighted && (
                                            <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest bg-white/20 text-white rounded-full px-3 py-1 mb-4">
                                                Most Popular Choice
                                            </span>
                                        )}
                                        <h3 className={cn('text-2xl font-bold mb-1', plan.highlighted ? 'text-white' : 'text-ink-950')}>
                                            {plan.name}
                                        </h3>
                                        <p className={cn('text-xs mb-6', plan.highlighted ? 'text-white/80' : 'text-ink-500')}>
                                            {plan.audience}
                                        </p>
                                        <div className="mb-7 pb-6 border-b border-current/10">
                                            <span className="text-xs font-bold uppercase tracking-wider">PKR</span>
                                            <span className="text-4xl font-extrabold ml-2 tracking-tight">{price}</span>
                                            <span className={cn('text-xs ml-1 font-medium', plan.highlighted ? 'text-white/70' : 'text-ink-500')}>/month</span>
                                            {isAnnual && <p className="mt-1 text-[10px] font-semibold text-white/80">Billed annually</p>}
                                        </div>
                                        <ul className="space-y-3 mb-8">
                                            {plan.features.map((feature) => (
                                                <li key={feature} className="flex items-start gap-2.5 text-xs sm:text-sm">
                                                    <Check className={cn('w-4 h-4 mt-0.5 shrink-0', plan.highlighted ? 'text-white' : 'text-brand')} />
                                                    <span className={plan.highlighted ? 'text-white/90 font-medium' : 'text-ink-700'}>{feature}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <Link href={`/customer/register?next=/customer/onboarding&plan=${encodeURIComponent(plan.name)}`}>
                                        <Button
                                            className={cn(
                                                'w-full rounded-full h-12 font-bold text-xs sm:text-sm cursor-pointer',
                                                plan.highlighted
                                                    ? 'bg-white hover:bg-ink-100 text-brand shadow-md'
                                                    : 'bg-ink-950 hover:bg-brand text-white shadow-md'
                                            )}
                                        >
                                            Start with {plan.name}
                                        </Button>
                                    </Link>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Add-ons & Billing Policy */}
                    <div className="mt-20 grid lg:grid-cols-[0.8fr_1.2fr] gap-10 items-start">
                        <div>
                            <span className="text-xs font-extrabold text-brand tracking-widest uppercase">Tailored Enhancements</span>
                            <h3 className="text-2xl sm:text-3xl font-extrabold mt-2 mb-4 text-ink-950">Optional Setup &amp; Add-ons</h3>
                            <p className="text-ink-600 text-sm leading-relaxed">
                                Accelerate your store launch with professional data migration, catalog upload, and custom theme engineering services.
                            </p>
                        </div>
                        <div className="bg-white rounded-3xl border border-ink-200 overflow-hidden shadow-sm">
                            {addOns.map(([name, price], i) => (
                                <div key={name} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-6 py-4.5 border-b border-ink-100 last:border-b-0">
                                    <span className="text-sm font-bold text-ink-800">{name}</span>
                                    <span className="text-xs font-extrabold text-brand">{price}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-10 rounded-3xl bg-ink-950 text-white p-6 sm:p-8 flex flex-col md:flex-row md:items-center gap-6 justify-between shadow-xl">
                        <div className="max-w-3xl">
                            <div className="flex items-center gap-2.5 mb-2">
                                <CreditCard className="w-5 h-5 text-brand" />
                                <h4 className="text-base font-bold text-white">Clear Billing Policy</h4>
                            </div>
                            <p className="text-xs sm:text-sm text-ink-300 leading-relaxed">
                                Monthly plans can be cancelled at any time before your next billing cycle. Annual plans include approximately two months free. Domain registration, SMS gateways, third-party payment provider fees, and custom development are billed separately.
                            </p>
                        </div>
                        <Link href="/#contact" className="shrink-0">
                            <Button className="rounded-full bg-white text-ink-950 hover:bg-brand hover:text-white px-7 font-bold text-xs">
                                Contact Sales Team
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* FAQ SECTION */}
            <FaqSection items={faqItems} />

            {/* FINAL CALL TO ACTION */}
            <section className="relative overflow-hidden bg-gradient-to-br from-ink-950 via-ink-900 to-black px-4 py-24 text-white text-center">
                <div className="pointer-events-none absolute inset-0 opacity-25 bg-grid-pattern" />
                <div className="container relative mx-auto max-w-3xl">
                    <div className="w-14 h-14 bg-brand/20 border border-brand/40 rounded-full flex items-center justify-center mx-auto mb-6 text-brand">
                        <Store className="w-7 h-7" />
                    </div>
                    <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4">
                        Ready to Launch Your Online Store?
                    </h2>
                    <p className="text-ink-300 text-sm sm:text-lg mb-8 max-w-xl mx-auto leading-relaxed">
                        Join modern merchants building high-converting e-commerce experiences with zero platform transaction fees.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link href="/customer/register?next=/customer/onboarding&plan=Growth" className="w-full sm:w-auto">
                            <Button size="lg" className="w-full sm:w-auto rounded-full bg-brand hover:bg-brand/90 text-white font-bold px-8 h-13 text-base shadow-xl shadow-brand/30">
                                Get Started Free
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </Link>
                        <Link href="/#contact" className="w-full sm:w-auto">
                            <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20 font-bold px-8 h-13 text-base">
                                Talk to Commerce Expert
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    );
};
