'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import {
    ArrowRight,
    BarChart3,
    Check,
    CheckCircle2,
    CreditCard,
    Globe2,
    LayoutTemplate,
    LockKeyhole,
    PackageCheck,
    Palette,
    ShoppingBag,
    Smartphone,
    Store,
    TrendingUp,
    Users,
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
    { icon: Palette, label: 'Theme editor' },
    { icon: Globe2, label: 'Custom domain support' },
    { icon: LockKeyhole, label: 'SSL certificate' },
    { icon: PackageCheck, label: 'Order and customer management' },
    { icon: CreditCard, label: 'No platform transaction fee' },
];

const plans = [
    {
        name: 'Starter',
        price: '3,500',
        audience: 'For Solo Entrepreneurs',
        features: ['1 Staff Account', 'Reporting and Analytics'],
    },
    {
        name: 'Growth',
        price: '7,000',
        audience: 'For Small Teams',
        features: ['5 Staff Accounts', 'WhatsApp integration', 'Payment Gateway Integration', 'Point Of Sale'],
        highlighted: true,
    },
    {
        name: 'Professional',
        price: '42,000',
        audience: 'For Global Reach',
        features: [
            '15 Staff Accounts',
            'Priority On Boarding',
            'Dedicated Support',
            'API access',
            'Custom integrations',
            'Custom Reports',
            'Custom Theme Design',
        ],
    },
    {
        name: 'Enterprise',
        price: '250,000',
        audience: 'For Complex Businesses',
        features: [
            'Everything in Professional',
            'Unlimited Staff Accounts',
            'Priority 24/7 Support on Call',
            'Fully customizable',
        ],
    },
];

const addOns = [
    ['Professional store setup', 'PKR 20,000 one-time'],
    ['Product upload service', 'Starting from PKR 10,000'],
    ['Custom theme design', 'Starting from PKR 40,000'],
    ['Custom feature development', 'Quoted separately'],
    ['Additional staff accounts', 'PKR 1000/account/month'],
    ['Additional storage', 'PKR 1,000 / month'],
    ['Priority migration from another platform', 'Starting from PKR 50,000'],
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
    return (
        <>
            <section className="relative isolate overflow-hidden bg-ink-950 px-4 pb-16 pt-36 text-white sm:pb-20 md:pt-44 lg:min-h-[880px] lg:pb-24">
                <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-22 border-b border-ink-100 bg-white" />
                <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.055)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_88%)]" />
                <div className="pointer-events-none absolute -left-32 top-24 h-96 w-96 rounded-full bg-brand/30 blur-[140px]" />
                <div className="pointer-events-none absolute -right-24 top-12 h-[34rem] w-[34rem] rounded-full bg-brand/20 blur-[160px]" />
                <div className="pointer-events-none absolute left-1/2 top-32 h-px w-[90%] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/15 to-transparent" />

                <div className="container relative z-10 mx-auto max-w-7xl">
                    <div className="grid items-center gap-16 lg:grid-cols-[0.83fr_1.17fr] lg:gap-10">
                        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }} className="relative z-20 max-w-2xl">
                            <div className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-xl">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand">
                                    <ShoppingBag className="h-3.5 w-3.5 text-white" />
                                </span>
                                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">Unity Commerce</span>
                                <span className="h-1 w-1 rounded-full bg-white/30" />
                                <span className="text-[11px] text-white/50">Built to sell</span>
                            </div>
                            <h1 className="max-w-xl text-balance text-5xl font-bold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-[4.7rem]">
                                Your store. <span className="text-white/45">Your brand.</span>{' '}
                                <span className="relative whitespace-nowrap text-white">
                                    Your growth.
                                    <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.7, delay: 0.55 }} className="absolute -bottom-2 left-0 h-1 w-full origin-left rounded-full bg-brand" />
                                </span>
                            </h1>
                            <p className="mb-9 mt-8 max-w-xl text-balance text-lg leading-relaxed text-white/60 sm:text-xl">
                                Launch and manage your online store with professional themes, powerful commerce tools and complete control over your brand.
                            </p>
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <Link href="/#contact">
                                    <Button size="lg" className="group h-13 w-full rounded-full bg-brand px-7 text-base text-white shadow-[0_14px_40px_rgba(140,24,27,.35)] transition-all hover:-translate-y-0.5 hover:brightness-110 sm:w-auto">
                                        Start Your Store <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                                    </Button>
                                </Link>
                                <Link href="#pricing">
                                    <Button variant="outline" size="lg" className="h-13 w-full rounded-full border-white/15 bg-white/[0.06] px-7 text-base text-white backdrop-blur-sm hover:bg-white/12 hover:text-white sm:w-auto">
                                        View Pricing
                                    </Button>
                                </Link>
                            </div>
                            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-white/45">
                                {['Secure cloud hosting', 'No transaction fee', 'Mobile-ready'].map((item) => (
                                    <span key={item} className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-white/75" />{item}</span>
                                ))}
                            </div>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, x: 40, rotateY: -4 }} animate={{ opacity: 1, x: 0, rotateY: 0 }} transition={{ duration: 0.8, delay: 0.15 }} className="relative mx-auto w-full max-w-[720px] [perspective:1200px]">
                            <div className="absolute -inset-8 rounded-[3rem] bg-brand/15 blur-3xl" />
                            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#f7f7f7] shadow-[0_40px_100px_rgba(0,0,0,.55)] ring-1 ring-black/20">
                                <div className="flex h-12 items-center gap-2 border-b border-black/10 bg-white px-4">
                                    <span className="h-2.5 w-2.5 rounded-full bg-brand" /><span className="h-2.5 w-2.5 rounded-full bg-ink-200" /><span className="h-2.5 w-2.5 rounded-full bg-ink-200" />
                                    <div className="mx-auto flex h-7 w-52 items-center justify-center rounded-lg bg-ink-50 text-[10px] text-ink-500">admin.yourstore.com</div>
                                </div>
                                <div className="grid min-h-[420px] grid-cols-[58px_1fr] sm:grid-cols-[170px_1fr]">
                                    <aside className="border-r border-black/5 bg-ink-950 p-3 sm:p-4">
                                        <div className="mb-7 flex items-center gap-2 text-white"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand"><ShoppingBag className="h-3.5 w-3.5" /></span><span className="hidden text-xs font-semibold sm:block">My Store</span></div>
                                        <div className="space-y-2">
                                            {['Overview', 'Orders', 'Products', 'Customers'].map((item, index) => <div key={item} className={cn('flex h-8 items-center gap-2 rounded-lg px-2 text-[10px]', index === 0 ? 'bg-white/10 text-white' : 'text-white/40')}><span className={cn('h-1.5 w-1.5 rounded-full', index === 0 ? 'bg-brand' : 'bg-white/20')} /><span className="hidden sm:block">{item}</span></div>)}
                                        </div>
                                    </aside>
                                    <div className="overflow-hidden p-4 text-ink-900 sm:p-6">
                                        <div className="mb-5 flex items-start justify-between"><div><p className="text-[10px] font-medium text-ink-400">STORE OVERVIEW</p><h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Good morning, John.</h2></div><span className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[10px] font-medium">Last 30 days</span></div>
                                        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
                                            {[['Total sales', 'PKR 284k', '+18.4%'], ['Orders', '1,429', '+12.8%'], ['Customers', '892', '+9.2%']].map(([label, value, change], index) => <div key={label} className={cn('rounded-xl border border-ink-100 bg-white p-3.5 sm:p-4', index === 2 && 'hidden lg:block')}><p className="text-[10px] text-ink-500">{label}</p><p className="mt-2 text-lg font-bold sm:text-xl">{value}</p><p className="mt-1 flex items-center gap-1 text-[9px] font-semibold text-success-600"><TrendingUp className="h-3 w-3" />{change}</p></div>)}
                                        </div>
                                        <div className="grid gap-3 lg:grid-cols-[1.45fr_.85fr]">
                                            <div className="rounded-xl border border-ink-100 bg-white p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold">Revenue</p><BarChart3 className="h-4 w-4 text-ink-400" /></div><div className="mt-6 flex h-28 items-end gap-2">{[38, 55, 47, 72, 58, 88, 68, 96, 78, 100, 83, 112].map((height, index) => <motion.span key={index} initial={{ height: 0 }} animate={{ height }} transition={{ duration: .45, delay: .55 + index * .035 }} className={cn('min-w-1 flex-1 rounded-t-sm', index > 8 ? 'bg-brand' : 'bg-brand/20')} />)}</div><div className="mt-3 flex justify-between text-[8px] text-ink-400"><span>01 Jul</span><span>15 Jul</span><span>30 Jul</span></div></div>
                                            <div className="hidden rounded-xl bg-ink-950 p-4 text-white lg:block"><div className="flex items-center justify-between"><p className="text-xs font-semibold">Live store</p><span className="h-2 w-2 rounded-full bg-success-500 ring-4 ring-success-500/15" /></div><div className="mt-5 rounded-xl bg-white/5 p-3"><div className="mx-auto flex aspect-square max-w-24 items-center justify-center rounded-xl bg-brand/20"><ShoppingBag className="h-9 w-9 text-brand" /></div><p className="mt-3 text-center text-[10px] font-medium">New collection</p></div></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} className="absolute -bottom-7 -left-3 flex items-center gap-3 rounded-2xl border border-white/60 bg-white/95 p-3.5 pr-5 text-ink-900 shadow-2xl backdrop-blur-xl sm:-left-8 sm:p-4 sm:pr-6">
                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-100"><CheckCircle2 className="h-5 w-5 text-success-600" /></span><div><p className="text-[10px] text-ink-500">New order received</p><p className="text-sm font-bold">PKR 12,450</p></div>
                            </motion.div>
                            <motion.div animate={{ y: [0, 7, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: .4 }} className="absolute -right-2 -top-7 hidden items-center gap-3 rounded-2xl border border-white/10 bg-ink-800/90 p-4 shadow-2xl backdrop-blur-xl sm:flex lg:-right-7">
                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand"><Store className="h-4 w-4" /></span><div><p className="text-[10px] text-white/45">Store status</p><p className="text-xs font-semibold">Online & selling</p></div>
                            </motion.div>
                        </motion.div>
                    </div>
                </div>
            </section>

            <section className="py-24 bg-ink-50">
                <div className="container mx-auto px-4 max-w-6xl">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold mb-4">Included With Every Plan</h2>
                        <p className="text-ink-600 max-w-2xl mx-auto">Everything you need to launch, operate and grow a professional online store.</p>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {includedFeatures.map((feature, idx) => (
                            <motion.div
                                key={feature.label}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: idx * 0.05 }}
                                className="bg-white rounded-2xl border border-ink-100 p-5 hover:border-brand/25 transition-colors"
                            >
                                <feature.icon className="w-6 h-6 text-brand mb-5" />
                                <p className="text-sm font-medium text-ink-800 leading-relaxed">{feature.label}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            <section id="pricing" className="py-24 bg-background scroll-mt-20">
                <div className="container mx-auto px-4 max-w-7xl">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold mb-4">Unity Commerce Pricing</h2>
                        <p className="text-ink-600 max-w-2xl mx-auto">Choose the plan that fits your business today. Annual plans include approximately two months free.</p>
                    </div>
                    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
                        {plans.map((plan, idx) => (
                            <motion.div
                                key={plan.name}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: idx * 0.08 }}
                                className={cn(
                                    'rounded-3xl p-7 border transition-all duration-300',
                                    plan.highlighted
                                        ? 'bg-brand border-brand text-white shadow-xl shadow-brand/20 xl:-mt-3'
                                        : 'bg-white border-ink-100 hover:border-brand/25 hover:shadow-lg'
                                )}
                            >
                                {plan.highlighted && <span className="inline-block text-xs font-semibold uppercase tracking-wide bg-white/15 rounded-full px-3 py-1 mb-4">Popular</span>}
                                <h3 className={cn('text-xl font-bold mb-2', plan.highlighted ? 'text-white' : 'text-ink-900')}>{plan.name}</h3>
                                <p className={cn('text-sm mb-6', plan.highlighted ? 'text-white/70' : 'text-ink-500')}>{plan.audience}</p>
                                <div className="mb-7">
                                    <span className="text-sm font-semibold">PKR</span>
                                    <span className="text-4xl font-bold ml-2">{plan.price}</span>
                                    <span className={cn('text-sm ml-1', plan.highlighted ? 'text-white/60' : 'text-ink-500')}>/month</span>
                                </div>
                                <ul className="space-y-3 mb-8 border-t border-current/10 pt-7">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-3 text-sm">
                                            <Check className={cn('w-4 h-4 mt-0.5 shrink-0', plan.highlighted ? 'text-white' : 'text-brand')} />
                                            <span className={plan.highlighted ? 'text-white/90' : 'text-ink-700'}>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Link href="/#contact">
                                    <Button className={cn('w-full rounded-full h-11', plan.highlighted ? 'bg-white hover:bg-ink-100 text-brand' : 'bg-brand hover:brightness-90 text-white')}>
                                        Choose {plan.name}
                                    </Button>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-24 bg-ink-50">
                <div className="container mx-auto px-4 max-w-6xl">
                    <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12 items-start">
                        <div>
                            <span className="text-xs font-semibold text-brand tracking-wide uppercase">Build beyond the plan</span>
                            <h2 className="text-3xl font-bold mt-3 mb-5">Optional Add-ons</h2>
                            <p className="text-ink-600 leading-relaxed">Add professional setup, migration, design and development services whenever your store needs more support.</p>
                        </div>
                        <div className="bg-white rounded-3xl border border-ink-100 overflow-hidden">
                            {addOns.map(([name, price]) => (
                                <div key={name} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-6 py-5 border-b border-ink-100 last:border-b-0">
                                    <span className="font-medium text-ink-800">{name}</span>
                                    <span className="text-sm font-semibold text-brand">{price}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-12 rounded-3xl bg-ink-950 text-white p-8 md:p-10 flex flex-col md:flex-row md:items-center gap-6 justify-between">
                        <div className="max-w-3xl">
                            <div className="flex items-center gap-3 mb-3">
                                <CreditCard className="w-5 h-5 text-white/80" />
                                <h3 className="text-xl font-bold">Billing Policy</h3>
                            </div>
                            <p className="text-ink-300 leading-relaxed">Monthly plans can be cancelled at any time. Annual plans include approximately two months free. Domain registration, payment-gateway charges, SMS usage and custom development are billed separately.</p>
                        </div>
                        <Link href="/#contact" className="shrink-0">
                            <Button className="rounded-full bg-white text-ink-800 hover:bg-ink-100 px-7">Talk to Sales</Button>
                        </Link>
                    </div>
                </div>
            </section>

            <FaqSection items={faqItems} />

            <section className="py-24 bg-gradient-to-br from-ink-950 to-black text-white text-center px-4">
                <div className="container mx-auto max-w-3xl">
                    <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Users className="w-7 h-7" />
                    </div>
                    <h2 className="text-4xl font-bold mb-6">Ready to Launch Your Online Store?</h2>
                    <p className="text-ink-300 mb-8 max-w-2xl mx-auto">Choose the right Unity Commerce plan and build a professional storefront around your brand.</p>
                    <Link href="/#contact">
                        <Button size="lg" className="bg-white text-ink-600 hover:bg-ink-100 rounded-full px-8 h-12">Start Your Store</Button>
                    </Link>
                </div>
            </section>
        </>
    );
};
