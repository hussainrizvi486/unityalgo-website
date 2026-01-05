"use client"

import Link from 'next/link';
import React from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';

export const NotFoundClient = () => {
    return (

        <div className="flex-1 flex items-center justify-center relative py-20">
            <div className="absolute inset-0 bg-grid-pattern mask-[radial-gradient(ellipse_at_center,black_40%,transparent_70%)] opacity-20 pointer-events-none" />

            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3],
                }}
                transition={{ duration: 8, repeat: Infinity }}
                className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-brand-500/5 rounded-full blur-[120px] pointer-events-none"
            />


            <div className="container mx-auto px-4 relative z-10 text-center">

                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="relative"
                >
                    <h1 className="text-[120px] md:text-[200px] font-black text-gray-600 leading-none select-none">
                        404
                    </h1>
                    <motion.div
                        initial={{ x: -10, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="absolute inset-0 flex items-center justify-center text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-brand-400 text-[120px] md:text-[200px] font-black leading-none mix-blend-overlay"
                    >
                        404
                    </motion.div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-100 mb-6">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-xs font-semibold text-red-700 tracking-wide uppercase">Signal Lost</span>
                    </div>

                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                        Page Not Found
                    </h2>

                    <p className="text-gray-600 text-lg max-w-lg mx-auto mb-10 text-balance">
                        The coordinates you entered point to a void. The page may have been moved, deleted, or never existed in this dimension.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link href="/">
                            <Button size="lg" className="rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-500/20 px-8 h-12">
                                <Home className="w-4 h-4 mr-2" /> Back to Home
                            </Button>
                        </Link>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}