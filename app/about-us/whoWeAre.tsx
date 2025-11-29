"use client"
import { motion } from "motion/react";
import { useInView } from "motion/react";
import { useRef } from "react";
import { Target } from "lucide-react";

export function WhoWeAre() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-20 px-2 md:px-4">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="mb-6 bg-linear-to-r from-[#8d0b0b] to-[#a01010] bg-clip-text ">
            Who We Are
          </h2>
          <p className="text-lg text-slate-700 max-w-3xl mx-auto">
            UnityAlgo is a creative tech studio specializing in modern web development, ERP solutions, and scalable digital products. We blend clean design, smart engineering, and real-world business insight to build tools that help companies grow with confidence.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl p-8 sm:p-12 border border-red-100 shadow-xl"
        >
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 bg-gradient-to-br from-[#8d0b0b] to-[#a01010] rounded-2xl flex items-center justify-center shadow-lg">
                <Target className="w-8 h-8 text-white" />
              </div>
            </div>
            <div>
              <h3 className="mb-4 text-slate-800">Our mission is simple:</h3>
              <p className="text-xl text-slate-700">
                Create technology that feels good to use and delivers real business value.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}