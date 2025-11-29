'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';


export function Hero() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const [positions] = useState(() => 
    Array.from({ length: 20 }).map(() => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
    }))
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);

    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-white via-[#F5F5F5] to-[#FAFAFA] pt-24 px-2 md:px-4"
    >

      <div className="absolute inset-0 overflow-hidden opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(123, 15, 15, 0.2) 1px, transparent 1px),
              linear-gradient(90deg, rgba(123, 15, 15, 0.2) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            transform: `perspective(500px) rotateX(60deg) scale(2)`,
            transformOrigin: 'center center',
          }}
        />
      </div>


      <motion.div
        className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(123, 15, 15, 0.15) 0%, rgba(165, 18, 18, 0.08) 50%, transparent 100%)',
        }}
        animate={{
          x: [0, 100, 0],
          y: [0, 50, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <motion.div
        className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(123, 15, 15, 0.12) 0%, rgba(46, 46, 46, 0.06) 50%, transparent 100%)',
        }}
        animate={{
          x: [0, -80, 0],
          y: [0, -60, 0],
          scale: [1, 1.3, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />


      {positions.map((row, index) => (
        <motion.div
          key={index}
          className="absolute w-1.5 h-1.5 bg-[#7B0F0F] rounded-full"
          style={{
            left: row.left,
            top: row.top
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{
            duration: 3 + index * 4,
            repeat: Infinity,
            delay: index * 2,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Animated Rings */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-64 h-64"
        animate={{ rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      >
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(123, 15, 15, 0.2)" strokeWidth="1" />
          <circle cx="100" cy="100" r="60" fill="none" stroke="rgba(123, 15, 15, 0.15)" strokeWidth="1" />
          <circle cx="100" cy="100" r="40" fill="none" stroke="rgba(123, 15, 15, 0.1)" strokeWidth="1" />
        </svg>
      </motion.div>

      <motion.div
        className="absolute bottom-1/4 right-1/4 w-80 h-80"
        animate={{ rotate: -360 }}
        transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
      >
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(46, 46, 46, 0.2)" strokeWidth="1" strokeDasharray="5,5" />
          <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(46, 46, 46, 0.15)" strokeWidth="1" />
          <circle cx="100" cy="100" r="50" fill="none" stroke="rgba(46, 46, 46, 0.1)" strokeWidth="1" strokeDasharray="3,3" />
        </svg>
      </motion.div>

      {/* Geometric Lines */}
      <svg className="absolute inset-0 w-full h-full opacity-15" xmlns="http://www.w3.org/2000/svg">
        <motion.line
          x1="0"
          y1="0"
          x2="100%"
          y2="100%"
          stroke="#7B0F0F"
          strokeWidth="1"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 3, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
        />
        <motion.line
          x1="100%"
          y1="0"
          x2="0"
          y2="100%"
          stroke="#7B0F0F"
          strokeWidth="1"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 3, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut', delay: 1.5 }}
        />
      </svg>

      {/* Parallax Mouse Effect */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          x: mousePosition.x / 50,
          y: mousePosition.y / 50,
        }}
        transition={{ type: 'spring', stiffness: 50, damping: 20 }}
      >
        <div className="absolute top-1/3 left-1/3 w-4 h-4 rounded-full bg-[#7B0F0F] opacity-20" />
        <div className="absolute top-2/3 right-1/3 w-3 h-3 rounded-full bg-[#7B0F0F] opacity-15" />
        <div className="absolute bottom-1/3 left-2/3 w-2 h-2 rounded-full bg-[#2E2E2E] opacity-20" />
      </motion.div>



      {/* Content */}
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <h1 className="text-[#222222] mb-6 text-3xl md:text-6xl font-bold">
              Empowering Businesses with {' '}
              <span className="relative inline-block">
                <span className="bg-linear-to-r from-[#7B0F0F] via-[#A51212] to-[#7B0F0F] bg-clip-text ">
                  Smarter Web Solutions
                </span>
              </span>
            </h1>
          </motion.div>

          <motion.p
            className="text-[#2E2E2E] mb-12 max-w-2xl mx-auto text-sm md:text-base"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
          >
            We design and build intelligent systems that drive digital transformation.
          </motion.p>

          <motion.div
            className="flex gap-4 justify-center items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
          >

            <Button
              className='bg-linear-to-r md:py-6 md:px-8 text-sm md:text-lg shadow-[#7B0F0F]/30 shadow-md from-[#7B0F0F] to-[#A51212]'
              size="lg"
            >
              Get Started
            </Button>

            <Link href="#services">

              <Button
                variant="outline"
                className='bg-linear-to-r md:py-6 md:px-8 text-sm md:text-lg shadow-md shadow-[#7B0F0F]/30'
                size="lg"
              >
                Learn More
              </Button>
            </Link>

          </motion.div>

          {/* Decorative Tech Elements */}
          <motion.div
            className="mt-20 flex flex-wrap justify-center gap-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            {[
              { icon: 'circle', label: 'Innovative', delay: 0.7 },
              { icon: 'square', label: 'Secure', delay: 0.8 },
              { icon: 'shield', label: 'Scalable', delay: 0.9 },
            ].map((item, index) => (
              <motion.div
                key={index}
                className="flex items-center gap-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: item.delay }}
                whileHover={{ y: -5 }}
              >
                <motion.div
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-[#7B0F0F] to-[#A51212] flex items-center justify-center shadow-lg shadow-[#7B0F0F]/30"
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                >
                  {item.icon === 'circle' && (
                    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                      <circle cx="12" cy="12" r="8" stroke="white" strokeWidth="2" />
                      <circle cx="12" cy="12" r="3" fill="white" />
                    </svg>
                  )}
                  {item.icon === 'square' && (
                    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                      <rect x="6" y="6" width="12" height="12" stroke="white" strokeWidth="2" rx="2" />
                      <circle cx="12" cy="12" r="2" fill="white" />
                    </svg>
                  )}
                  {item.icon === 'shield' && (
                    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                      <path d="M12 2L4 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-8-4z" stroke="white" strokeWidth="2" />
                    </svg>
                  )}
                </motion.div>
                <span className="text-[#2E2E2E]">{item.label}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* Scroll Indicator */}
          <motion.div
            className="mt-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1 }}
          >
            <motion.div
              className="w-6 h-10 border-2 border-[#7B0F0F] rounded-full mx-auto relative cursor-pointer"
              onClick={() => scrollToSection('services')}
              whileHover={{ scale: 1.1 }}
            >
              <motion.div
                className="w-1.5 h-2 bg-[#7B0F0F] rounded-full absolute left-1/2 top-2 -translate-x-1/2"
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Subtle Vignette Effect */}
      <div className="absolute inset-0 bg-gradient-to-t from-white/20 via-transparent to-white/10 pointer-events-none" />
    </section>
  );
}