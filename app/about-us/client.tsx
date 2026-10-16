'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Target, Lightbulb, Users, Rocket, CheckCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';


export const AboutContent = () => {
    return (
        <main>

            <section className="relative pt-hero pb-section px-page">
                <div className="absolute inset-0 bg-grid-pattern mask-[radial-gradient(ellipse_at_top,var(--scrim)_30%,transparent_70%)] opacity-30 pointer-events-none" />
                <div className="absolute top-0 right-0 w-125 h-125 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

                <div className="site-container site-container-wide text-center relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent border border-primary/15 mb-6">
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            <span className="text-xs font-semibold text-primary tracking-wide uppercase">Our DNA</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl tracking-tight mb-8 text-balance">
                            Architecting the <br />
                            <span className="text-primary">Future of Business</span>
                        </h1>
                        <p className="text-xl text-foreground/70 max-w-3xl mx-auto leading-relaxed text-balance">
                            We are Unity Algo. We exist to untangle complexity and build intelligent,
                            scalable systems that drive real-world impact.
                        </p>
                    </motion.div>
                </div>
            </section>


            <section className="bg-card relative site-section-spacing">
                <div className="site-container site-gutters site-container-wide">
                    <div className="grid md:grid-cols-12 gap-gap-lg">


                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="md:col-span-7 bg-muted p-8 md:p-12 rounded-2xl border border-border/60"
                        >
                            <h3 className="text-2xl mb-6 ">Who We Are</h3>
                            <div className="space-y-gap text-foreground/70 leading-relaxed">
                                <p>
                                    Unity Algo is a digital transformation and software engineering company dedicated to building intelligent,
                                    scalable, and future-ready solutions for businesses around the world. We help organisations streamline operations,
                                    automate workflows, and unlock new levels of efficiency through advanced technology.
                                </p>
                                <p>
                                    Since our inception, we’ve partnered with companies across industries to modernize their processes,
                                    improve visibility, and accelerate growth through smart, data-driven systems. From white-labeled
                                    <span className="font-semibold text-primary"> ERPNext implementations</span> to fully custom enterprise software,
                                    Unity Algo empowers businesses to perform better, faster, and smarter.
                                </p>
                            </div>
                        </motion.div>

                        {/* Stat/Highlight Block */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="md:col-span-5 flex flex-col gap-gap-lg"
                        >
                            <div className="flex-1 bg-primary p-8 rounded-2xl text-primary-foreground flex flex-col justify-center relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-foreground/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                                <Rocket className="w-10 h-10 mb-4 text-primary-foreground" />
                                <h4 className="text-3xl mb-2">IS360 Framework</h4>
                                <p className="text-primary-foreground/80 text-sm">
                                    Our proprietary framework for continuous innovation and support, ensuring your tech stack never becomes obsolete.
                                </p>
                            </div>

                            <div className="flex-1 bg-card border border-border p-8 rounded-2xl shadow-sm flex items-center gap-gap hover:border-primary/25 transition-colors">
                                <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center shrink-0">
                                    <CheckCircle className="w-6 h-6 text-success" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-foreground">100%</div>
                                    <div className="text-sm text-muted-foreground">Project Delivery Rate</div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* --- MISSION & VISION (Split View) --- */}
            <section className="bg-primary text-primary-foreground relative overflow-hidden site-section-spacing">
                {/* Background Glows */}
                <div className="absolute top-1/2 left-1/4 w-150 h-150 bg-primary/20 rounded-full blur-3xl pointer-events-none -translate-y-1/2" />

                <div className="site-container site-gutters site-container-wide relative z-10">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                        >
                            <h2 className="text-sm text-primary-foreground/70 tracking-widest uppercase mb-4">Our North Star</h2>
                            <h3 className="text-4xl md:text-5xl mb-6 leading-tight">
                                Turning complex challenges into seamless <span className="underline decoration-primary decoration-2 underline-offset-4">digital experiences.</span>
                            </h3>
                            <Button className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 px-8 py-6 text-lg font-medium">
                                Work With Us <ArrowRight className="ml-2 w-5 h-5" />
                            </Button>
                        </motion.div>

                        <div className="space-y-gap-xl">
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.1 }}
                                className="bg-primary-foreground/5 backdrop-blur-sm border border-primary-foreground/10 p-8 rounded-xl hover:bg-primary-foreground/10 transition-colors"
                            >
                                <div className="flex items-start gap-gap">
                                    <Target className="w-8 h-8 text-primary-foreground/80 shrink-0 mt-1" />
                                    <div>
                                        <h4 className="text-xl mb-2">Our Mission</h4>
                                        <p className="text-primary-foreground/80 leading-relaxed text-sm">
                                            To help enterprises accelerate adoption of new technologies, untangle complex issues during digital evolution, and orchestrate ongoing innovation. We lead the process from ideation to delivery.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.2 }}
                                className="bg-primary-foreground/5 backdrop-blur-sm border border-primary-foreground/10 p-8 rounded-xl hover:bg-primary-foreground/10 transition-colors"
                            >
                                <div className="flex items-start gap-gap">
                                    <Lightbulb className="w-8 h-8 text-warning shrink-0 mt-1" />
                                    <div>
                                        <h4 className="text-xl mb-2">Our Vision</h4>
                                        <p className="text-primary-foreground/80 leading-relaxed text-sm">
                                            To be the global catalyst for intelligent business transformation, where technology is not just a tool, but the very fabric of operational excellence.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- OUR APPROACH (Values) --- */}
            <section className="bg-background site-section-spacing">
                <div className="site-container site-gutters site-container-wide text-center">
                    <div className="mb-16">
                        <h2 className="text-3xl mb-4">Why Businesses Trust Unity Algo</h2>
                        <p className="text-foreground/70 max-w-2xl mx-auto">
                            We don&apos;t just deliver software; we deliver certainty in an uncertain digital landscape.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-gap">
                        {[
                            {
                                icon: Users,
                                title: "Client-Centric DNA",
                                desc: "Your goals are our blueprint. We work as an extension of your team, not just a vendor."
                            },
                            {
                                icon: Rocket,
                                title: "Agile Execution",
                                desc: "We move fast without breaking things. Our iterative process ensures rapid time-to-value."
                            },
                            {
                                icon: CheckCircle,
                                title: "End-to-End Ownership",
                                desc: "From the first whiteboard sketch to post-launch scaling, we own the outcome."
                            }
                        ].map((item, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: idx * 0.1 }}
                                className="p-8 rounded bg-card shadow-sm hover:shadow-xl hover:cursor-pointer hover:shadow-foreground/5 transition-all duration-300 group"
                            >
                                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/90 transition-colors">
                                    <item.icon className="w-7 h-7 text-primary group-hover:text-primary-foreground transition-colors" />
                                </div>

                                <h3 className="text-lg text-foreground mb-3">{item.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>
        </main>
    )
}