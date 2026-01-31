import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layouts/header";
import { Footer } from "@/components/layouts/footer";

export const metadata: Metadata = {
  title: "Privacy Policy | UnityAlgo",
  description: "Learn how UnityAlgo collects, protects, and manages your personal data. Our commitment to privacy and transparency.",
  openGraph: {
    title: "Privacy Policy | UnityAlgo",
    description: "Transparency is core to our values. Read our Privacy Policy to understand how we handle your data.",
    url: "https://unityalgo.com/privacy-policy",
    type: "website",
  },
  alternates: {
    canonical: "/privacy-policy",
  }
};

const Page = () => {
  return (
    <main className="bg-background min-h-screen flex flex-col">
      <Header />

      <div className="flex-1 pt-32 pb-20">

        <div className="absolute inset-0 bg-grid-pattern mask-[linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)] opacity-20 pointer-events-none -z-10" />

        <div className="container mx-auto max-w-4xl px-4 md:px-6 space-y-8">
          <div className="space-y-4 border-b border-gray-100 pb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 border border-gray-200 mb-2">
              <span className="w-2 h-2 rounded-full bg-brand-600"></span>
              <span className="text-xs font-semibold text-gray-600 tracking-wide uppercase">Legal</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-brand-900">Privacy Policy</h1>
            <p className="text-lg text-gray-600 leading-relaxed">
              At UnityAlgo, we respect your privacy and are committed to protecting your personal information.
              This Privacy Policy explains what data we collect, how we use it, and the rights you have regarding
              your personal information. Our goal is to provide full transparency and a safe, secure experience
              when using our services.
            </p>
          </div>

          {/* Information Collection */}
          <section className="space-y-4 py-4">
            <h2 className="text-2xl font-bold text-gray-900">Information We Collect</h2>

            <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Personal Information</h3>
              <p className="text-gray-600 mb-4">
                We may collect certain personal details when you interact with our website or submit information
                through forms. This includes, but is not limited to:
              </p>

              <ul className="list-disc pl-5 space-y-2 text-gray-600">
                <li>Full name</li>
                <li>Email address</li>
                <li>Phone number</li>
                <li>Company name</li>
                <li>Address, City, State, ZIP/Postal Code</li>
              </ul>
            </div>
          </section>

          {/* Usage Data */}
          <section className="space-y-4 py-4">
            <h3 className="text-xl font-semibold text-gray-800">Usage Data</h3>
            <div className="text-gray-600 space-y-4">
              <p>We automatically collect Usage Data when you browse or interact with our website.</p>
              <p>
                This may include your IP address, browser type, browser version, the pages you visit, time spent
                on pages, device identifiers, and other diagnostic data helping us analyze and improve our
                website.
              </p>
              <p>
                If you access our website using a mobile device, we may also collect information such as device
                type, mobile OS, browser type, device ID, and IP address.
              </p>
              <p>
                We may also collect technical information sent by your browser when you visit our site or access
                it through a mobile device.
              </p>
            </div>
          </section>

          {/* Retention */}
          <section className="space-y-4 py-4">
            <h2 className="text-2xl font-bold text-gray-900">Retention of Your Data</h2>
            <div className="text-gray-600 space-y-4">
              <p>
                We retain your Personal Data only for as long as necessary to fulfill the purposes outlined in
                this Privacy Policy. This includes meeting legal obligations, resolving disputes, and enforcing
                our agreements.
              </p>
              <p>
                Usage Data is typically retained for a shorter duration unless needed to improve website
                performance, strengthen security, or comply with legal requirements.
              </p>
            </div>
          </section>

          {/* Data Transfer */}
          <section className="space-y-4 py-4">
            <h3 className="text-xl font-semibold text-gray-800">Transfer of Your Personal Data</h3>
            <div className="text-gray-600 space-y-4">
              <p>
                Your data may be processed on servers located outside your region or country, where data
                protection laws may differ. By using our website, you consent to this transfer.
              </p>
              <p>
                We take necessary precautions to ensure your data is handled securely and in accordance with
                this Privacy Policy.
              </p>
              <p>
                We do not transfer Personal Data to any organization without verifying that adequate security
                measures are in place.
              </p>
            </div>
          </section>

          {/* Disclosure */}
          <section className="space-y-4 py-4">
            <h2 className="text-2xl font-bold text-gray-900">Disclosure of Your Personal Data</h2>

            <div className="grid md:grid-cols-2 gap-6 mt-4">
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Business Transactions</h3>
                <p className="text-gray-600 text-sm">
                  In the event of a merger, acquisition, or sale of assets, your Personal Data may be transferred.
                  You will be notified before your data becomes subject to a different privacy policy.
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Legal Requirements</h3>
                <ul className="list-disc pl-5 space-y-1 text-gray-600 text-sm">
                  <li>Comply with legal obligations</li>
                  <li>Protect the rights or property of UnityAlgo</li>
                  <li>Investigate potential misuse of our services</li>
                  <li>Ensure the safety of our users or the public</li>
                  <li>Defend against legal liabilities</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Cookies */}
          <section className="space-y-4 py-4">
            <h2 className="text-2xl font-bold text-gray-900">Cookies & Tracking Technologies</h2>
            <p className="text-gray-600">
              We use cookies and similar technologies to enhance user experience, remember preferences, analyze
              website performance, and deliver a more personalized browsing experience. You may disable cookies in
              your browser, but some features may not function properly.
            </p>
          </section>

          {/* Links */}
          <section className="space-y-4 py-4">
            <h2 className="text-2xl font-bold text-gray-900">Links to Other Websites</h2>
            <p className="text-gray-600">
              Our website may contain links to external websites. UnityAlgo is not responsible for the content or
              privacy practices of third-party websites. We strongly encourage reviewing their privacy policies
              before interacting with them.
            </p>
          </section>

          {/* Security */}
          <section className="space-y-4 py-4">
            <h2 className="text-2xl font-bold text-gray-900">Security of Your Personal Data</h2>
            <p className="text-gray-600">
              We use industry-standard security measures to protect your data. However, no online transmission is
              completely secure. While we strive to protect your information, we cannot guarantee absolute
              security.
            </p>
          </section>

          {/* Children's Privacy */}
          <section className="space-y-4 py-4">
            <h2 className="text-2xl font-bold text-gray-900">Children’s Privacy</h2>
            <p className="text-gray-600">
              Our services are not intended for individuals under the age of 13, and we do not knowingly collect
              information from children. If you believe a child has provided us with personal data, please contact
              us immediately.
            </p>
          </section>

          {/* Contact */}
          <section className="space-y-6 py-8 border-t border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900">Contact Us</h2>
            <p className="text-gray-600">
              If you have any questions or concerns about this Privacy Policy, feel free to contact us:
            </p>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex items-center gap-3 text-gray-600">
                <span className="font-semibold text-brand-900">Email:</span>
                <a href="mailto:info@unityalgo.com" className="hover:text-brand-600 underline decoration-gray-300 underline-offset-4">info@unityalgo.com</a>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <span className="font-semibold text-brand-900">Website:</span>
                <Link href="/" className="hover:text-brand-600 underline decoration-gray-300 underline-offset-4">unityalgo.com</Link>
              </div>
            </div>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
};

export default Page;
