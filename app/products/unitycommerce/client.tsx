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
            <section className="relative pt-40 pb-20 md:pt-52 md:pb-32 px-4">
                <div className="absolute inset-0 bg-grid-pattern mask-[radial-gradient(ellipse_at_top,black_30%,transparent_70%)] opacity-30 pointer-events-none" />
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand/5 rounded-full blur-[120px] pointer-events-none" />

                <div className="container mx-auto max-w-6xl relative z-10">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent border border-brand/15 mb-6">
                                <ShoppingBag className="w-3.5 h-3.5 text-brand" />
                                <span className="text-xs font-semibold text-brand tracking-wide uppercase">Unity Commerce</span>
                            </div>
                            <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-8 text-balance">
                                Your store. Your brand. Your growth.
                            </h1>
                            <p className="text-xl text-ink-600 leading-relaxed text-balance mb-10">
                                Launch and manage your online store with professional themes, powerful commerce tools and complete control over your brand.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <Link href="/#contact">
                                    <Button size="lg" className="rounded-full bg-brand hover:brightness-90 text-white px-8 h-12 text-base shadow-lg shadow-brand/20">
                                        Start Your Store <ArrowRight className="ml-1 w-4 h-4" />
                                    </Button>
                                </Link>
                                <Link href="#pricing">
                                    <Button variant="outline" size="lg" className="rounded-full bg-white px-8 h-12 text-base">
                                        View Pricing
                                    </Button>
                                </Link>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 40 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="relative"
                        >
                            <div className="rounded-3xl border border-ink-200 bg-white shadow-2xl p-3">
                                <div className="rounded-2xl bg-ink-950 overflow-hidden">
                                    <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
                                        <span className="w-2.5 h-2.5 rounded-full bg-brand" />
                                        <span className="w-2.5 h-2.5 rounded-full bg-ink-500" />
                                        <span className="w-2.5 h-2.5 rounded-full bg-ink-300" />
                                        <span className="ml-auto text-xs text-ink-400">yourstore.com</span>
                                    </div>
                                    <div className="grid grid-cols-[1fr_1.15fr] min-h-80">
                                        <div className="p-6 flex flex-col justify-center">
                                            <span className="text-xs uppercase tracking-widest text-ink-400 mb-3">New collection</span>
                                            <h2 className="text-3xl font-bold text-white mb-4">Commerce that feels like you.</h2>
                                            <div className="w-24 h-9 bg-brand rounded-full" />
                                        </div>
                                        <div className="bg-ink-100 p-5 grid grid-cols-2 gap-3 content-center">
                                            {[1, 2, 3, 4].map((item) => (
                                                <div key={item} className="rounded-xl bg-white border border-ink-200 p-3">
                                                    <div className="aspect-square rounded-lg bg-accent mb-3 flex items-center justify-center">
                                                        <ShoppingBag className="w-7 h-7 text-brand" />
                                                    </div>
                                                    <div className="h-2 rounded-full bg-ink-200 mb-2" />
                                                    <div className="h-2 w-1/2 rounded-full bg-brand/20" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="absolute -bottom-6 -left-6 bg-white border border-ink-100 shadow-xl rounded-2xl p-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                                    <BarChart3 className="w-5 h-5 text-brand" />
                                </div>
                                <div>
                                    <div className="text-xs text-ink-500">Store performance</div>
                                    <div className="font-bold text-ink-900">One dashboard</div>
                                </div>
                            </div>
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
