"use client"
import { motion } from "motion/react";
import { useInView } from "motion/react";
import { useRef } from "react";
import { CheckCircle2, Users } from "lucide-react";

export function WhyTrustUs() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const reasons = [
    "Transparent communication",
    "On-time delivery",
    "Clean, scalable code",
    "Design-driven development",
    "Real results, not just promises"
  ];

  return (
    <section ref={ref} className="py-20 px-2 md:px-4 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 text-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#8d0b0b] rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#a01010] rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto max-w-6xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-6 py-2 mb-6">
            <Users className="w-4 h-4" />
            <span className="text-sm">Building Trust Through Excellence</span>
          </div>
          <h2 className="mb-6 text-white">Why Businesses Trust Us</h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-4"
          >
            {reasons.map((reason, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                className="flex items-center gap-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 hover:bg-white/20 transition-colors"
              >
                <CheckCircle2 className="w-6 h-6 text-[#8d0b0b] flex-shrink-0 bg-white rounded-full p-1" />
                <span className="text-lg">{reason}</span>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col justify-center"
          >
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 sm:p-10">
              <h3 className="mb-6 text-white">We don&#39;t just build software.</h3>
              <p className="text-xl text-slate-200 mb-6">
                We build long-term partnerships.
              </p>
              <div className="h-1 w-24 bg-linear-to-r from-[#8d0b0b] to-[#a01010] rounded-full"></div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}