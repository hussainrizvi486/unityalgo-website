'use client';

import { Facebook, Linkedin, Github } from 'lucide-react';
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
    <footer className="bg-[#2E2E2E] text-white py-12">
      <div className="container mx-auto px-2 md:px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-5">
          {/* Company Info */}
          <div className="md:col-span-2">
            <div className="mb-4 text-white">
              <Logo className="h-10" />
            </div>
            <p className="text-gray-300 max-w-md" style={{ lineHeight: '1.6' }}>
              Empowering businesses with cutting-edge web and enterprise solutions.
              Building the future, one line of code at a time.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="mb-4" style={{ fontSize: '1.125rem', fontWeight: 600 }}>
              Quick Links
            </h4>
            <ul className="space-y-2 ">
              <li>
                <Link
                  href='/'
                  onClick={() => scrollToSection('#Hero')}
                  className="text-gray-300 hover:text-white transition-colors cursor-pointer"
                >
                  Home
                </Link>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('#services')}
                  className="text-gray-300 hover:text-white transition-colors cursor-pointer"
                >
                  Services
                </button>
              </li>
              <li>
                <Link
                  href='/about-us'
                  className="text-gray-300 hover:text-white transition-colors cursor-pointer"
                >
                  About Us
                </Link>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('#contact')}
                  className="text-gray-300 hover:text-white transition-colors cursor-pointer"
                >
                  Contact
                </button>
              </li>
              <li>
                <Link href="/privacy-policy" className="text-gray-300 hover:text-white transition-colors cursor-pointer">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Social Media */}
          <div>
            <h4 className="mb-4" style={{ fontSize: '1.125rem', fontWeight: 600 }}>
              Connect With Us
            </h4>
            <div className="flex gap-3">
              <Link
                href="https://www.facebook.com/profile.php?id=61583797718151"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-[#7B0F0F] flex items-center justify-center transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5" />
              </Link>
              <Link
                href="https://www.linkedin.com/company/unityalgo/posts/?feedView=all"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-[#7B0F0F] flex items-center justify-center transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </Link>
              <Link
                href="https://github.com/orgs/UnityAlgo/dashboard"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-[#7B0F0F] flex items-center justify-center transition-colors"
                aria-label="GitHub"
              >
                <Github className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/10 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-300 text-center md:text-left">
              © 2025 UnityAlgo. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link href="/privacy-policy" className="text-gray-300 hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <a href="#" className="text-gray-300 hover:text-white transition-colors">
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
