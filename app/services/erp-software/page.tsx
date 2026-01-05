'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { Header } from '@/components/layouts/header';
import { Footer } from '@/components/layouts/footer';
import { Button } from '@/components/ui/button';
import {
  BarChart3, Layers, Users,
  ShoppingCart, Truck, Stethoscope, GraduationCap,
  Briefcase, Factory, Store,
  Zap, Headphones, CheckCircle2,
  LucideIcon
} from 'lucide-react';
import Link from 'next/link';

export default function ERPServicesView() {
  return (
    <main className="bg-background text-foreground min-h-screen overflow-hidden">
      <Header />

      {/* --- HERO SECTION --- */}
      <section className="relative pt-40 pb-20 md:pt-52 md:pb-32 px-4">
        {/* Background Decor */}
        <div className="absolute inset-0 bg-grid-pattern mask-[radial-gradient(ellipse_at_top,black_30%,transparent_70%)] opacity-30 pointer-events-none" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-500/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="container mx-auto max-w-6xl text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 mb-6">
              <span className="w-2 h-2 rounded-full bg-brand-600 animate-pulse" />
              <span className="text-xs font-semibold text-brand-700 tracking-wide uppercase">Powered by ERPNext</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-brand-900 mb-8 text-balance">
              The Operating System for <br />
              Scaling Businesses

            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed text-balance mb-10">
              Streamline operations, unify data, and accelerate growth with our tailored ERPNext solutions.
              The complete enterprise platform built for the modern era.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/#contact">
                <Button size="lg" className="rounded-full bg-brand-600 hover:bg-brand-700 text-white px-8 h-12 text-base shadow-lg shadow-brand-500/20">
                  Book a Free Demo
                </Button>
              </Link>

              <Link href="/services/erp#erp-modules">
                <Button variant="outline" size="lg" className="rounded-full border-gray-200 hover:bg-gray-50 text-gray-900 px-8 h-12 text-base">
                  Explore Modules
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* --- BUSINESS PROBLEMS SOLVED --- */}
      <section className="py-24 bg-white relative">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-brand-900 mb-4">Eliminate Operational Chaos</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              We replace fragmented tools and manual spreadsheets with a single source of truth.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "Operational Inefficiencies",
                desc: "Automate manual tasks and workflows to reduce errors and free up your team for high-value work.",
                color: "bg-red-50 text-red-600"
              },
              {
                title: "Data Fragmentation",
                desc: "Unify sales, inventory, and accounting into one platform for real-time visibility across the board.",
                color: "bg-blue-50 text-blue-600"
              },
              {
                title: "Lack of Scalability",
                desc: "A system that grows with you, handling millions of transactions without breaking a sweat.",
                color: "bg-purple-50 text-purple-600"
              },
              {
                title: "Blind Decision Making",
                desc: "Replace guesswork with customizable dashboards and reports that offer actionable insights.",
                color: "bg-amber-50 text-amber-600"
              },
              {
                title: "Compliance Risk",
                desc: "Automated audit trails and documentation to ensure you adhere to industry regulations effortlessly.",
                color: "bg-green-50 text-green-600"
              }
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="p-8 rounded-3xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:shadow-xl hover:shadow-brand-900/5 transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-2xl ${item.color} flex items-center justify-center mb-6`}>
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>


      <section className="py-24 bg-gray-900 text-white relative overflow-hidden" id='erp-modules'>
        <div className="absolute top-1/2 right-0 w-[600px] h-[600px] bg-brand-600/10 rounded-full blur-[120px] pointer-events-none -translate-y-1/2" />

        <div className="container mx-auto px-4 max-w-6xl relative z-10">
          <div className="mb-16">
            <span className="text-brand-400 font-semibold tracking-widest uppercase text-sm mb-2 block">Comprehensive Suite</span>
            <h2 className="text-3xl md:text-4xl font-bold">Core ERP Modules</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
            {[
              { icon: BarChart3, title: "Accounting & Finance", desc: "General ledger, AP/AR, budgeting, and real-time financial reporting." },
              { icon: Layers, title: "Inventory Management", desc: "Multi-location tracking, stock transfers, and automated purchasing." },
              { icon: Users, title: "Sales & CRM", desc: "Manage leads, track orders, and forecast sales in one pipeline." },
              { icon: ShoppingCart, title: "Purchasing", desc: "Supplier scorecards, automated POs, and purchase receipts." },
              { icon: Briefcase, title: "HR & Payroll", desc: "Employee lifecycle management, leave tracking, and automated payroll." },
              { icon: Factory, title: "Manufacturing", desc: "Production planning, BOM management, and work order tracking." }
            ].map((module, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="group p-6 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >

                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
                    <module.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold group-hover:text-brand-400 transition-colors">{module.title}</h3>
                </div>

                <p className="text-sm text-gray-400 leading-relaxed pl-14">
                  {module.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* --- INTERFACE SHOWCASE --- */}
      <section className="py-24 bg-gray-50 overflow-hidden">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-20">
            <span className="text-brand-600 font-semibold tracking-widest uppercase text-sm mb-2 block">Visual Tour</span>
            <h2 className="text-3xl md:text-4xl font-bold text-brand-900">Experience the Interface</h2>
            <p className="text-gray-600 mt-4 max-w-2xl mx-auto">
              Designed for clarity and speed. Our interface reduces clicks and helps you find what you need instantly.
            </p>
          </div>

          <div className="space-y-24">

            {/* Feature 1: Dashboards */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="relative rounded-2xl shadow-2xl overflow-hidden border border-gray-200 group"
              >
                {/* Placeholder for Dashboard Image */}
                <div className="aspect-[16/10] bg-gray-200 relative">
                  <Image
                    src="/images/erp-dashboard.png"
                    alt="ERP Dashboard Interface"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center mb-6 text-brand-600">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Real-Time Dashboards</h3>
                <p className="text-gray-600 leading-relaxed mb-6">
                  Get a comprehensive view of your business at a glance. Customizable widgets allow you to track sales trends, project statuses, and financial health in real-time.
                </p>
                <ul className="space-y-3">
                  {['Drag-and-drop widgets', 'Role-specific views', 'Instant drill-down'].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-green-500" /> {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>

            {/* Feature 2: Workspaces & Pages */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="order-2 md:order-1"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6 text-blue-600">
                  <Layers className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Dedicated Workspaces</h3>
                <p className="text-gray-600 leading-relaxed mb-6">
                  Clutter-free workspaces designed for focus. Each department gets a tailored home page with quick shortcuts to frequently used modules and pages.
                </p>
                <ul className="space-y-3">
                  {['Accounting Workspace', 'HR & Payroll Hub', 'Manufacturing Command'].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-green-500" /> {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="order-1 md:order-2 relative rounded-2xl shadow-2xl overflow-hidden border border-gray-200"
              >
                <div className="aspect-[16/10] bg-gray-200 relative">
                  <Image
                    src="/images/erp-workspace.png"
                    alt="ERP Workspace Interface"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              </motion.div>
            </div>

            {/* Feature 3: List Views & Reports */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="relative rounded-2xl shadow-2xl overflow-hidden border border-gray-200"
              >
                <div className="aspect-[16/10] bg-gray-200 relative">
                  <Image
                    src="/images/erp-listview.png"
                    alt="ERP Reports Interface"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-6 text-purple-600">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Smart List Views & Reports</h3>
                <p className="text-gray-600 leading-relaxed mb-6">
                  Turn raw data into insights. Filter, group, and analyze data directly in the list view, or generate report builder charts with a single click.
                </p>
                <ul className="space-y-3">
                  {['Gantt & Kanban Views', 'Custom Report Builder', 'Auto-scheduled Email Reports'].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-green-500" /> {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>

            {/* Feature 4: Point of Sale */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="order-2 md:order-1"
              >
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-6 text-amber-600">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Modern Point of Sale</h3>
                <p className="text-gray-600 leading-relaxed mb-6">
                  A touch-friendly POS interface that works offline. Manage inventory, apply discounts, and handle multi-currency payments seamlessly.
                </p>
                <ul className="space-y-3">
                  {['Offline Capability', 'Touch-Optimized UI', 'Integrated Loyalty Program'].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-green-500" /> {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="order-1 md:order-2 relative rounded-2xl shadow-2xl overflow-hidden border border-gray-200"
              >
                <div className="aspect-[16/10] bg-gray-200 relative">
                  <Image
                    src="/images/erp-pos.png"
                    alt="ERP POS Interface"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              </motion.div>
            </div>

          </div>
        </div>
      </section>

      {/* --- INDUSTRIES & FEATURES (Bento Grid Style) --- */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4 max-w-6xl">

          {/* Industries Header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-brand-900 mb-4">Tailored for Your Industry</h2>
            <p className="text-gray-600">Built to handle the unique workflows of diverse sectors.</p>
          </div>

          <div className="grid md:grid-cols-4 gap-4 mb-32">
            {[
              { icon: Store, name: "Retail", desc: "Integrated POS & Loyalty" },
              { icon: Factory, name: "Manufacturing", desc: "Supply Chain & IoT" },
              { icon: Stethoscope, name: "Healthcare", desc: "Patient Data & Billing" },
              { icon: GraduationCap, name: "Education", desc: "Student Mgmt & LMS" },
              { icon: Truck, name: "Distribution", desc: "Logistics & Fulfillment" },
              { icon: Briefcase, name: "Services", desc: "Project Mgmt & Billing" }
            ].map((industry, idx) => (
              <div key={idx} className={`p-6 rounded-2xl bg-white border border-gray-100 flex flex-col items-center text-center hover:border-brand-200 transition-colors ${idx === 0 || idx === 5 ? 'md:col-span-2' : ''}`}>
                <industry.icon className="w-8 h-8 text-brand-600 mb-3" />
                <h4 className="font-bold text-gray-900">{industry.name}</h4>
                <p className="text-xs text-gray-500 mt-1">{industry.desc}</p>
              </div>
            ))}
          </div>

          {/* Key Features Header */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-brand-900">Advanced Capabilities</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
            <FeatureCard title="Real-time Dashboards" desc="Track KPIs across all departments instantly." />
            <FeatureCard title="Integrated POS" desc="Offline-capable POS with barcode scanning." />
            <FeatureCard title="Mobile Access" desc="Manage your business from anywhere, on any device." />
            <FeatureCard title="Global Ready" desc="Multi-currency and multi-language support built-in." />
            <FeatureCard title="Advanced Analytics" desc="Deep data visualization for strategic decisions." />
            <FeatureCard title="Restaurant Mode" desc="Kitchen display systems and table management." />
          </div>


        </div>
      </section>

      {/* --- SERVICES & SUPPORT --- */}
      <section className="py-24 bg-white border-t border-gray-100">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-brand-900">We Don&apos;t Just Install, We Partner</h2>
            <p className="text-gray-600 mt-4">End-to-end support to ensure your success.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <ServiceCard icon={Users} title="Onboarding & Training" desc="Personalized setup assistance, documentation, and staff training sessions." />
            <ServiceCard icon={Headphones} title="24/7 Ongoing Support" desc="Round-the-clock troubleshooting and regular system updates." />
            <ServiceCard icon={Briefcase} title="Strategic Consulting" desc="Workflow optimization consulting to get the most out of your ERP." />
          </div>

        </div>
      </section>

      {/* --- WHY CHOOSE US & CTA --- */}
      <section className="py-24 bg-gradient-to-br from-brand-900 to-black text-white text-center px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-4xl font-bold mb-8">Why Choose UnityAlgo?</h2>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 mb-16 text-left">
            {[
              { title: "Scalability", desc: "From startup to enterprise." },
              { title: "Flexibility", desc: "Adapts to your workflows." },
              { title: "Cost-Effective", desc: "Open-source foundation." },
              { title: "Security", desc: "Enterprise-grade protection." }
            ].map((item, idx) => (
              <div key={idx} className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
                <CheckCircle2 className="w-5 h-5 text-brand-400 mb-2" />
                <h4 className="font-bold">{item.title}</h4>
                <p className="text-xs text-gray-400 mt-1">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-white/5 border border-white/10 p-8 md:p-12 rounded-3xl">
            <h3 className="text-2xl md:text-3xl font-bold mb-4">Ready to Transform Your Business?</h3>
            <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
              Schedule a free consultation to see how our ERP solutions can streamline your operations and drive growth.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/#contact">
                <Button size="lg" className="bg-brand-600 hover:bg-brand-500 text-white rounded-full px-8 h-12">
                  Get Your Free Consultation
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function FeatureCard({ title, desc }: { title: string, desc: string }) {
  return (
    <div className="flex gap-4 p-4 hover:bg-gray-50 rounded-xl transition-colors">
      <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
        <CheckCircle2 className="w-5 h-5 text-brand-600" />
      </div>
      <div>
        <h4 className="font-bold text-gray-900">{title}</h4>
        <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

function ServiceCard({ icon: Icon, title, desc }: { icon: LucideIcon, title: string, desc: string }) {
  return (
    <div className="text-center p-8 border border-gray-100 rounded-3xl hover:shadow-xl hover:shadow-brand-900/5 transition-all">
      <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-brand-600">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-500 leading-relaxed">{desc}</p>
    </div>
  )
}