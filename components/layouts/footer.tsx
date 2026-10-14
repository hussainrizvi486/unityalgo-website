'use client';

import { Facebook, Linkedin } from 'lucide-react';
import { Logo } from '../Logo';
import Link from 'next/link';

export function Footer() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-ink-950 text-white py-12">
      <div className="site-container site-gutters">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-5">
          {/* Company Info */}
          <div className="md:col-span-2">
            <div className="mb-4 text-white">
              <Logo className="h-10" />
            </div>
            <p className="footer-description text-ink-300 max-w-md">
              Empowering businesses with cutting-edge web and enterprise solutions.
              Building the future, one line of code at a time.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="footer-heading mb-4">
              Quick Links
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href='/'
                  onClick={() => scrollToSection('#Hero')}
                  className="text-ink-300 hover:text-white transition-colors cursor-pointer"
                >
                  Home
                </Link>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('#services')}
                  className="text-ink-300 hover:text-white transition-colors cursor-pointer"
                >
                  Services
                </button>
              </li>
              <li>
                <Link
                  href='/about-us'
                  className="text-ink-300 hover:text-white transition-colors cursor-pointer"
                >
                  About Us
                </Link>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('#contact')}
                  className="text-ink-300 hover:text-white transition-colors cursor-pointer"
                >
                  Contact
                </button>
              </li>
              <li>
                <Link href="/privacy-policy" className="text-ink-300 hover:text-white transition-colors cursor-pointer">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="footer-heading mb-4">
              Products
            </h4>
            <ul className="space-y-2 ">
              <li>
                <Link href="/products/algosuite" className="text-ink-300 hover:text-white transition-colors cursor-pointer">
                  AlgoSuite
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="footer-heading mb-4">
              Connect With Us
            </h4>
            <div className="flex gap-3">
              <Link
                href="https://www.facebook.com/profile.php?id=61583797718151"
                className="w-10 h-10 rounded-full bg-white/10 hover:brightness-90 flex items-center justify-center transition-colors"
                aria-label="Facebook"
                target='_blank'
              >
                <Facebook className="w-5 h-5" />
              </Link>
              <Link
                href="https://www.linkedin.com/company/unityalgo/posts/?feedView=all"
                className="w-10 h-10 rounded-full bg-white/10 hover:brightness-90 flex items-center justify-center transition-colors"
                aria-label="LinkedIn"
                target='_blank'
              >
                <Linkedin className="w-5 h-5" />
              </Link>
              {/* <Link
                href="https://github.com/orgs/UnityAlgo/dashboard"
                className="w-10 h-10 rounded-full bg-white/10 hover:brightness-90 flex items-center justify-center transition-colors"
                aria-label="GitHub"
              >
                <Github className="w-5 h-5" />
              </Link> */}
            </div>
          </div>
        </div>


        <div className="pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-center md:text-left">
              &copy; 2026 UnityAlgo. All rights reserved.
            </p>
            {/* <div className="flex gap-6">
              <Link href="/privacy-policy">
                Privacy Policy
              </Link>
            </div> */}
          </div>
        </div>
      </div>
    </footer>
  );
}
