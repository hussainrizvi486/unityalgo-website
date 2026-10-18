'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TextAlignJustify, X as CloseIcon, ChevronDown, ArrowRight } from 'lucide-react';
import { create } from 'zustand';

import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import {
  NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuTrigger,
  NavigationMenuContent, NavigationMenuLink, navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { cn } from '@/utils';

const serviceLinks = [
  { name: 'Tailored Software Development', href: '/services/digital-product-engineering', desc: 'Bespoke systems built around how your business already works.' },
  { name: 'Cloud & DevOps', href: '/services/cloud-devops', desc: 'Scalable infrastructure, automated deploys and real monitoring.' },
  { name: 'Web App Development', href: '/services/web-development', desc: 'Fast, secure web applications built to keep growing.' },
  { name: 'Mobile Development', href: '/services/mobile-development', desc: 'iOS and Android apps that feel native on both.' },
];

const productLinks = [
  { name: 'AlgoSuite', href: '/products/algosuite', desc: 'Our ERP platform — accounting, HR, inventory and CRM.', status: null },
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


const DesktopNav = ({ isScrolled }: { isScrolled: boolean }) => (
  <NavigationMenu
    className={cn(
      'rounded-lg px-1 py-1 transition-colors duration-300',
      isScrolled ? 'bg-card/60' : 'bg-card/70',
    )}
  >
    <NavigationMenuList>
      <NavigationMenuItem>
        <NavigationMenuTrigger>Products</NavigationMenuTrigger>
        <NavigationMenuContent>
          <ul className="grid w-104 gap-1 p-2">
            {productLinks.map((link) => (
              <li key={link.name}>
                <NavigationMenuLink asChild>
                  <Link href={link.href}>
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      {link.name}
                    </span>
                    <span className="text-xs leading-snug text-muted-foreground">{link.desc}</span>
                  </Link>
                </NavigationMenuLink>
              </li>
            ))}
          </ul>
        </NavigationMenuContent>
      </NavigationMenuItem>

      <NavigationMenuItem>
        <NavigationMenuTrigger>Services</NavigationMenuTrigger>
        <NavigationMenuContent>
          <ul className="grid w-136 grid-cols-2 gap-1 p-2">
            {serviceLinks.map((link) => (
              <li key={link.name}>
                <NavigationMenuLink asChild>
                  <Link href={link.href}>
                    <span className="font-medium text-foreground">{link.name}</span>
                    <span className="text-xs leading-snug text-muted-foreground">{link.desc}</span>
                  </Link>
                </NavigationMenuLink>
              </li>
            ))}
          </ul>
          <div className="border-t border-border/60 p-2">
            <NavigationMenuLink asChild>
              <Link href="/services" className="flex-row items-center justify-between">
                <span className="font-medium text-foreground">All services</span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
              </Link>
            </NavigationMenuLink>
          </div>
        </NavigationMenuContent>
      </NavigationMenuItem>

      {[
        { name: 'About', href: '/about-us' },
        { name: 'Blog', href: '/blog' },
      ].map((link) => (
        <NavigationMenuItem key={link.name}>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <Link href={link.href}>{link.name}</Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
      ))}
    </NavigationMenuList>
  </NavigationMenu>
);

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
        className={`site-header-layer fixed top-0 left-0 right-0 transition-all duration-500 ease-in-out border-b ${isScrolled
          ? 'bg-card/40 backdrop-blur-xl border-primary-foreground/20 shadow-sm'
          : 'bg-transparent border-transparent'
          }`}
      >
        <div className="site-container site-gutters">
          <div className={`flex items-center justify-between transition-[height] duration-500 ${isScrolled ? 'h-[calc(var(--header-h)*0.8)]' : 'h-header'}`}>
            <div className="shrink-0 flex items-center">
              <Logo />

            </div>


            <div className='hidden md:block'>
              <DesktopNav isScrolled={isScrolled} />
            </div>
            <div className="hidden md:flex items-center gap-gap">
              <Link href="#contact">
                {}
                <Button className="py-2 transition-all duration-300 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
                  Get Started
                </Button>
              </Link>
            </div>


            <button
              className="md:hidden p-2 text-foreground/70"
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
  const [servicesOpen, setServicesOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="site-navigation-layer fixed inset-0 bg-card pt-[calc(var(--header-h)+var(--gap))] md:hidden"
    >
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.25 }}
        className="h-full overflow-y-auto border-t border-border/60"
      >
        <nav className="site-container max-w-lg site-gutters py-6 pb-10">
          <Link href="/" onClick={closeMenu} className="flex items-center px-4 py-3.5 rounded-lg text-base font-semibold text-foreground hover:bg-muted transition-colors">
            Home
          </Link>

          <MobileNavGroup label="Services" open={servicesOpen} onToggle={() => setServicesOpen((open) => !open)} links={serviceLinks} onNavigate={closeMenu} />
          <MobileNavGroup label="Products" open={productsOpen} onToggle={() => setProductsOpen((open) => !open)} links={productLinks} onNavigate={closeMenu} />

          <div className="my-5 h-px bg-secondary" />

          {navLinks
            .filter((link) => link.name !== 'Home')
            .map((link) => (
              <Link key={link.name} href={link.href} onClick={closeMenu} className="flex items-center px-4 py-3.5 rounded-lg text-base font-semibold text-foreground hover:bg-muted transition-colors">
                {link.name}
              </Link>
            ))}

          <Button asChild className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md" size="sm"><Link href="/#contact" onClick={closeMenu} className="block mt-6">
              Get Started
            </Link></Button>
        </nav>
      </motion.div>
    </motion.div>
  )
}

const MobileNavGroup = ({
  label,
  open,
  onToggle,
  links,
  onNavigate,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  links: { name: string; href: string }[];
  onNavigate: () => void;
}) => (
  <div className="mt-3 rounded-xl border border-border/60 bg-muted/70 overflow-hidden">
    <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-center justify-between px-4 py-3.5 text-left text-base font-semibold text-foreground hover:bg-secondary/70 transition-colors">
      <span>{label}</span>
      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
    </button>

    <AnimatePresence initial={false}>
      {open && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
          <div className="px-2 pb-2 border-t border-border/60">
            {links.map((link) => (
              <Link key={link.name} href={link.href} onClick={onNavigate} className="block px-3 py-3 rounded-lg text-sm font-medium text-foreground/80 hover:bg-card hover:text-foreground transition-colors">
                {link.name}
              </Link>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
)


