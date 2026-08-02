'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TextAlignJustify, X as CloseIcon, ChevronDown } from 'lucide-react';
import { create } from 'zustand';

import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';

const serviceLinks = [
  { name: 'ERP', href: '/services/erp-software' },
  { name: 'Accounting', href: '/services/accounting' },
  { name: 'Stock', href: '/services/stock' },
  { name: 'Manufacturing', href: '/services/manufacturing' },
  { name: 'Retail', href: '/services/retail' },
  { name: 'Enterprise Application Development', href: '/services/enterprise-application-development' },
];

const navLinks = [
  { name: 'Home', href: '/' },
  { name: 'About Us', href: '/about-us' },
  { name: 'Blog', href: '/blog' },
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
            <div className="shrink-0 flex items-center">
              <Logo />

              <nav className="hidden md:flex items-center px-2 py-1.5 rounded-full ml-12">
                <Link href="/">
                  <button className="relative px-5 py-2 text-sm font-medium text-ink-600 transition-colors hover: rounded-full group overflow-hidden">
                    <span className="relative z-10 font-semibold text-black">Home</span>
                    <div className="absolute inset-0 bg-ink-200/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full" />
                  </button>
                </Link>

                <ServicesDropdown />

                <Link href="/about-us">
                  <button className="relative px-5 py-2 text-sm font-medium text-ink-600 transition-colors hover: rounded-full group overflow-hidden">
                    <span className="relative z-10 font-semibold text-black">About Us</span>
                    <div className="absolute inset-0 bg-ink-200/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full" />
                  </button>
                </Link>

                <Link href="/blog">
                  <button className="relative px-5 py-2 text-sm font-medium text-ink-600 transition-colors hover: rounded-full group overflow-hidden">
                    <span className="relative z-10 font-semibold text-black">Blog</span>
                    <div className="absolute inset-0 bg-ink-200/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full" />
                  </button>
                </Link>

                <Link href="/#contact">
                  <button className="relative px-5 py-2 text-sm font-medium text-ink-600 transition-colors hover: rounded-full group overflow-hidden">
                    <span className="relative z-10 font-semibold text-black">Contact</span>
                    <div className="absolute inset-0 bg-ink-200/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full" />
                  </button>
                </Link>
              </nav>

            </div>


            <div className="hidden md:flex items-center gap-4">
              <Link href="#contact">
                {/* sm:text-base bg-brand hover:bg-brand text-white rounded-full shadow-lg shadow-brand/25 transition-all */}
                <Button
                  className="rounded-full transition-all duration-300  bg-brand hover:brightness-90 text-white shadow-md "
                >
                  Get Started
                </Button>
              </Link>
            </div>


            <button
              className="md:hidden p-2 text-ink-600"
              onClick={() => state.setMobileMenuOpen(!state.mobileMenuOpen)}
            >
              {state.mobileMenuOpen ? <CloseIcon className='stroke-3 size-6' /> : <TextAlignJustify className='stroke-3 size-6' />}
            </button>
          </div>
        </div>
      </header >


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
      <div className="flex flex-col gap-4 text-center overflow-y-auto pb-10">
        <Link
          href="/"
          onClick={() => setMobileMenuOpen(false)}
          className="font-medium text-ink-800 hover:text-brand"
        >
          Home
        </Link>

        <div className="pt-2 pb-1 text-xs font-semibold text-ink-400 uppercase tracking-wide">Services</div>
        {serviceLinks.map((link) => (
          <Link
            key={link.name}
            href={link.href}
            onClick={() => setMobileMenuOpen(false)}
            className="font-medium text-ink-800 hover:text-brand"
          >
            {link.name}
          </Link>
        ))}

        {navLinks
          .filter((link) => link.name !== 'Home')
          .map((link) => (
            <Link
              key={link.name}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="font-medium text-ink-800 hover:text-brand"
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

const ServicesDropdown = () => {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button className="relative px-5 py-2 text-sm font-medium text-ink-600 transition-colors hover: rounded-full group overflow-hidden flex items-center gap-1">
        <span className="relative z-10 font-semibold text-black">Services</span>
        <ChevronDown className={`relative z-10 w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        <div className="absolute inset-0 bg-ink-200/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-1/2 -translate-x-1/2 pt-3 w-64"
          >
            <div className="bg-white rounded-2xl border border-ink-100 shadow-xl p-2">
              {serviceLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="block px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 hover:opacity-75 rounded-xl transition-colors"
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};