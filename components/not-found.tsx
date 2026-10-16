"use client"

import Link from 'next/link';
import React from 'react';
import { motion } from 'motion/react';
import { Home } from 'lucide-react';

export const NotFoundClient = () => {
    return (

        <div className="flex-1 flex items-center justify-center relative py-20">
            <div className="absolute inset-0 bg-grid-pattern mask-[radial-gradient(ellipse_at_center,var(--scrim)_40%,transparent_70%)] opacity-20 pointer-events-none" />

            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3],
                }}
                transition={{ duration: 8, repeat: Infinity }}
                className="absolute top-1/3 left-1/4 w-125 h-125 rounded-full blur-3xl pointer-events-none"
            />


            <div className="container mx-auto px-4 relative z-10 text-center">

                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="relative"
                >
                    <h1 className="text-[calc(var(--display-size)*2.5)] md:text-[calc(var(--display-size)*4)] leading-none select-none">
                        404
                    </h1>
                    <motion.div
                        initial={{ x: -10, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="absolute inset-0 flex items-center justify-center text-primary/40 text-[calc(var(--display-size)*2.5)] md:text-[calc(var(--display-size)*4)] font-black leading-none mix-blend-overlay"
                    >
                        404
                    </motion.div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    

                    <h2 className="text-3xl md:text-4xl text-foreground mb-4">
                        Page Not Found
                    </h2>

                    <p className="text-foreground/70 text-lg max-w-lg mx-auto mb-10 text-balance">
                        The coordinates you entered point to a void. The page may have been moved, deleted, or never existed in this dimension.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-gap">
                        <Link href="/">
                            <div className="hover:text-primary text-foreground  flex items-center gap-2">
                                <Home className="size-8" /> <div className="text-lg font-medium">Back to Home</div>
                            </div>
                        </Link>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}