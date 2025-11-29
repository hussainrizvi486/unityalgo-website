"use client";
import { motion } from "motion/react";
import { useInView } from "motion/react";
import { useRef } from "react";
import { Eye, Heart, Rocket, TrendingUp, Star } from "lucide-react";
import Link from "next/link";

export function VisionAndPromise() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const promises = [
    { icon: Rocket, text: "Easy to use" },
    { icon: TrendingUp, text: "Easy to scale" },
    { icon: Star, text: "Easy to love" }
  ];

  return (
    <section ref={ref} className="py-20 px-2 md:px-4 bg-slate-50">
      <div className="container mx-auto max-w-6xl">
        {/* Our Vision */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-red-100 text-[#8d0b0b] rounded-full px-6 py-2 mb-6">
              <Eye className="w-4 h-4" />
              <span className="text-sm">Looking Ahead</span>
            </div>
            <h2 className="mb-6 bg-linear-to-r from-[#8d0b0b] to-[#a01010] bg-clip-text ">
              Our Vision
            </h2>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-gradient-to-br from-[#8d0b0b] to-[#a01010] rounded-3xl p-8 sm:p-12 text-white text-center shadow-2xl relative overflow-hidden"
          >
            {/* Background decoration */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl"></div>
            </div>

            <p className="text-xl sm:text-2xl relative z-10 max-w-4xl mx-auto">
              To create a world where businesses—small or large—can grow through simple, elegant, and dependable technology.
            </p>
          </motion.div>
        </motion.div>

        {/* Our Promise */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-red-100 text-[#8d0b0b] rounded-full px-6 py-2 mb-6">
              <Heart className="w-4 h-4" />
              <span className="text-sm">Our Commitment</span>
            </div>
            <h2 className="mb-6 bg-linear-to-r from-[#8d0b0b] to-[#a01010] bg-clip-text ">
              Our Promise
            </h2>
            <p className="text-lg text-slate-700 max-w-3xl mx-auto">
              UnityAlgo is committed to delivering solutions that are:
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {promises.map((promise, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
                whileHover={{ y: -8 }}
                className="group"
              >
                <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-slate-200 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#8d0b0b] to-[#a01010] rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                    <promise.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-slate-800">{promise.text}</h3>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Final CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center mt-20"
        >
          <Link href='/contact-us' className="inline-block bg-linear-to-r from-slate-900 to-slate-800 rounded-2xl px-8 py-6">
            <p className="text-xl text-white">
              Ready to build something amazing together?
            </p>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}