"use client";
import { motion } from "motion/react";
import { useInView } from "motion/react";
import { useRef } from "react";
import { Brain, Sparkles, Zap, Handshake } from "lucide-react";

export function OurApproach() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const approaches = [
    {
      icon: Brain,
      title: "Understanding",
      description: "We take time to understand your goals and challenges."
    },
    {
      icon: Sparkles,
      title: "Creativity",
      description: "We craft modern designs that stand out."
    },
    {
      icon: Zap,
      title: "Precision",
      description: "We engineer with reliability and performance in mind."
    },
    {
      icon: Handshake,
      title: "Partnership",
      description: "We work with you, not for you."
    }
  ];

  return (
    <section ref={ref} className="py-20 px-2 md:px-4 bg-white">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="mb-6 bg-linear-to-r from-[#8d0b0b] to-[#a01010] bg-clip-text ">
            Our Approach
          </h2>
          <p className="text-lg text-slate-700 max-w-3xl mx-auto">
            At UnityAlgo, we believe good technology is built with:
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-8 mb-12">
          {approaches.map((approach, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5, delay: 0.1 * index }}
              className="relative group"
            >
              <div className="bg-gradient-to-br from-slate-50 to-red-50 rounded-2xl p-8 border border-red-100 hover:border-red-300 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#8d0b0b] to-[#a01010] rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <approach.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-slate-800">{approach.title}</h3>
                    <p className="text-slate-600">{approach.description}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center bg-linear-to-r from-[#8d0b0b] to-[#a01010] rounded-2xl p-8 text-white"
        >
          <p className="text-xl">
            This blend of creativity and engineering is what makes our work stand out.
          </p>
        </motion.div>
      </div>
    </section>
  );
}