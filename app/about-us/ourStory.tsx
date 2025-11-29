"use client";
import { motion } from "motion/react";
import { useInView } from "motion/react";
import { useRef } from "react";
import { Heart, Ear, Lightbulb, Shield } from "lucide-react";

export function OurStory() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const principles = [
    { icon: Ear, text: "Listen closely" },
    { icon: Lightbulb, text: "Build thoughtfully" },
    { icon: Shield, text: "Deliver with integrity" }
  ];

  return (
    <section ref={ref} className="py-20 px-2 md:px-4 bg-white">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="mb-6 bg-linear-to-r from-[#8d0b0b] to-[#a01010] bg-clip-text ">
            Our Story
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <p className="text-lg text-slate-700 mb-6">
              UnityAlgo started with a belief that technology should work for people, not confuse them.
            </p>
            <p className="text-lg text-slate-700 mb-6">
              We began as a small group of developers who loved solving problems and creating meaningful digital experiences. Today, we build products that empower businesses of all sizes from startups to established brands.
            </p>
            <p className="text-lg text-slate-700 mb-8">
              Every project we take on is guided by the same principles:
            </p>

            <div className="space-y-4">
              {principles.map((principle, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                  transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
                  className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-[#8d0b0b] to-[#a01010] rounded-lg flex items-center justify-center flex-shrink-0">
                    <principle.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-slate-800">{principle.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative"
          >
            <div className="bg-gradient-to-br from-[#8d0b0b] to-[#a01010] rounded-2xl p-8 sm:p-12 text-white shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <Heart className="w-8 h-8" />
                <h3 className="text-white">The Heart of UnityAlgo</h3>
              </div>
              <p className="text-lg text-red-100">
                This mindset is the heart of UnityAlgo. We don&#39;t just write code—we create experiences that make a difference in how businesses operate and grow.
              </p>
              
              {/* Decorative elements */}
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-orange-400 rounded-full opacity-20 blur-2xl"></div>
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-red-400 rounded-full opacity-20 blur-2xl"></div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}