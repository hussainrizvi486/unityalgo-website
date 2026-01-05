'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TextAlignJustify, X as CloseIcon } from 'lucide-react';
import { create } from 'zustand';

import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';

const navLinks = [
  { name: 'Home', href: '/' },
  { name: 'Services', href: '/#services' },
  { name: 'About Us', href: '/about-us' },
  { name: 'Contact', href: '/#contact' },
];

interface UIState {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
}

export const UIStore = create<UIState>((set) => ({
  mobileMenuOpen: false,
  setMobileMenuOpen: (open: boolean) => set({ mobileMenuOpen: open }),
  toggleMobileMenu: () => set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),

}))

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const state = UIStore();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out border-b ${isScrolled
          ? 'bg-white/70 backdrop-blur-xl border-white/20 shadow-sm py-3'
          : 'bg-transparent border-transparent py-5'
          }`}
      >
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between">


            <div className="shrink-0">
              <Logo />
            </div>
            <nav className="hidden md:flex items-center gap-1 bg-white/50 backdrop-blur-md px-2 py-1.5 rounded-full border border-white/20 shadow-sm">
              {navLinks.map((link) => (
                <Link key={link.name} href={link.href}>
                  <button className="relative px-5 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-brand-900 rounded-full group overflow-hidden">
                    <span className="relative z-10">{link.name}</span>
                    <div className="absolute inset-0 bg-gray-200/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full" />
                  </button>
                </Link>
              ))}
            </nav>


            <div className="hidden md:flex items-center gap-4">
              <Link href="#contact">
                <Button
                  className={`rounded-full transition-all duration-300 ${isScrolled
                    ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-md'
                    : 'bg-white hover:bg-gray-50 text-brand-900 shadow-sm border border-gray-100'
                    }`}
                >
                  Get Started
                </Button>
              </Link>
            </div>


            <button
              className="md:hidden p-2 text-gray-600"
              onClick={() => state.setMobileMenuOpen(!state.mobileMenuOpen)}
            >
              {state.mobileMenuOpen ? <CloseIcon className='stroke-3 size-6' /> : <TextAlignJustify className='stroke-3 size-6' />}
            </button>
          </div>
        </div>
      </header>


      <AnimatePresence>
        {state.mobileMenuOpen && (
          <MobileMenu />
        )}
      </AnimatePresence>
    </>
  );
}

const MobileMenu = () => {
  const { setMobileMenuOpen } = UIStore();
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed inset-0 z-40 bg-white pt-24 px-6 md:hidden"
    >
      <div className="flex flex-col gap-4 text-center">
        {navLinks.map((link) => (
          <Link
            key={link.name}
            href={link.href}
            onClick={() => setMobileMenuOpen(false)}
            className="font-medium text-gray-800 hover:text-brand-600"
          >
            {link.name}
          </Link>
        ))}
        <Button className="w-full mt-4" size="sm">
          Get Started
        </Button>
      </div>
    </motion.div>
  )
}