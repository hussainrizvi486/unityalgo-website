'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Header } from '@/components/layouts/header';
import { Footer } from '@/components/layouts/footer';
import { Target, Lightbulb, Users, Rocket, CheckCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AboutUsView() {
  return (
  <main className="bg-background text-foreground min-h-screen overflow-hidden">
      <Header />

      {/* --- HERO SECTION --- */}
      <section className="relative pt-40 pb-20 md:pt-52 md:pb-32 px-4">
        {/* Background Decor */}
        <div className="absolute inset-0 bg-grid-pattern [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)] opacity-30 pointer-events-none" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-500/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="container mx-auto max-w-6xl text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 mb-6">
              <span className="w-2 h-2 rounded-full bg-brand-600 animate-pulse" />
              <span className="text-xs font-semibold text-brand-700 tracking-wide uppercase">Our DNA</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-brand-900 mb-8 text-balance">
              Architecting the <br />
              <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text ">
                Future of Business
              </span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed text-balance">
              We are Unity Algo. We exist to untangle complexity and build intelligent, 
              scalable systems that drive real-world impact.
            </p>
          </motion.div>
        </div>
      </section>


      <section className="py-20 bg-white relative">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid md:grid-cols-12 gap-6">
            
            
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="md:col-span-7 bg-gray-50 p-8 md:p-12 rounded-3xl border border-gray-100"
            >
              <h3 className="text-2xl font-bold mb-6 text-brand-900">Who We Are</h3>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  Unity Algo is a digital transformation and software engineering company dedicated to building intelligent, 
                  scalable, and future-ready solutions for businesses around the world. We help organisations streamline operations, 
                  automate workflows, and unlock new levels of efficiency through advanced technology.
                </p>
                <p>
                  Since our inception, we’ve partnered with companies across industries to modernize their processes, 
                  improve visibility, and accelerate growth through smart, data-driven systems. From white-labeled 
                  <span className="font-semibold text-brand-700"> ERPNext implementations</span> to fully custom enterprise software, 
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
               className="md:col-span-5 flex flex-col gap-6"
            >
              <div className="flex-1 bg-brand-900 p-8 rounded-3xl text-white flex flex-col justify-center relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-600 rounded-full blur-[50px] -translate-y-1/2 translate-x-1/2 group-hover:bg-brand-500 transition-colors" />
                <Rocket className="w-10 h-10 mb-4 text-brand-200" />
                <h4 className="text-3xl font-bold mb-2">IS360 Framework</h4>
                <p className="text-brand-100 text-sm">
                  Our proprietary framework for continuous innovation and support, ensuring your tech stack never becomes obsolete.
                </p>
              </div>

              <div className="flex-1 bg-white border border-gray-200 p-8 rounded-3xl shadow-sm flex items-center gap-4 hover:border-brand-200 transition-colors">
                 <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                 </div>
                 <div>
                    <div className="text-2xl font-bold text-gray-900">100%</div>
                    <div className="text-sm text-gray-500">Project Delivery Rate</div>
                 </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* --- MISSION & VISION (Split View) --- */}
      <section className="py-24 bg-gray-900 text-white relative overflow-hidden">
         {/* Background Glows */}
         <div className="absolute top-1/2 left-1/4 w-[600px] h-[600px] bg-brand-600/20 rounded-full blur-[120px] pointer-events-none -translate-y-1/2" />
         
         <div className="container mx-auto px-4 max-w-6xl relative z-10">
            <div className="grid md:grid-cols-2 gap-16 items-center">
               <motion.div
                 initial={{ opacity: 0, y: 20 }}
                 whileInView={{ opacity: 1, y: 0 }}
                 viewport={{ once: true }}
               >
                  <h2 className="text-sm font-semibold text-brand-400 tracking-widest uppercase mb-4">Our North Star</h2>
                  <h3 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                     Turning complex challenges into seamless <span className="text-brand-500">digital experiences.</span>
                  </h3>
                  <Button className="bg-white text-brand-900 hover:bg-gray-100 rounded-full px-8 py-6 text-lg font-medium">
                     Work With Us <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
               </motion.div>

               <div className="space-y-8">
                  <motion.div 
                     initial={{ opacity: 0, x: 20 }}
                     whileInView={{ opacity: 1, x: 0 }}
                     viewport={{ once: true }}
                     transition={{ delay: 0.1 }}
                     className="bg-white/5 backdrop-blur-sm border border-white/10 p-8 rounded-2xl hover:bg-white/10 transition-colors"
                  >
                     <div className="flex items-start gap-4">
                        <Target className="w-8 h-8 text-brand-400 shrink-0 mt-1" />
                        <div>
                           <h4 className="text-xl font-bold mb-2">Our Mission</h4>
                           <p className="text-gray-300 leading-relaxed text-sm">
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
                     className="bg-white/5 backdrop-blur-sm border border-white/10 p-8 rounded-2xl hover:bg-white/10 transition-colors"
                  >
                     <div className="flex items-start gap-4">
                        <Lightbulb className="w-8 h-8 text-yellow-400 shrink-0 mt-1" />
                        <div>
                           <h4 className="text-xl font-bold mb-2">Our Vision</h4>
                           <p className="text-gray-300 leading-relaxed text-sm">
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
      <section className="py-24 bg-background">
         <div className="container mx-auto px-4 max-w-6xl text-center">
            <div className="mb-16">
               <h2 className="text-3xl font-bold text-brand-900 mb-4">Why Businesses Trust Unity Algo</h2>
               <p className="text-gray-600 max-w-2xl mx-auto">
                  We don&apos;t just deliver software; we deliver certainty in an uncertain digital landscape.
               </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
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
                     className="p-8 rounded-3xl bg-white border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-brand-900/5 transition-all duration-300 group"
                  >
                     <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-brand-600 transition-colors">
                        <item.icon className="w-7 h-7 text-brand-600 group-hover:text-white transition-colors" />
                     </div>
                     <h3 className="text-lg font-bold text-gray-900 mb-3">{item.title}</h3>
                     <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                  </motion.div>
               ))}
            </div>
         </div>
      </section>

      <Footer />
    </main>
  );
}