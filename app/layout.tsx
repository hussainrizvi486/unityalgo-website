import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import Script from "next/script";
import { cn } from "@/utils";

import "./globals.css";

const poppins = Poppins({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-poppins',
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900']
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
  ? `https://${process.env.NEXT_PUBLIC_BASE_URL}`
  : 'https://unityalgo.com';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Software Development Company | ERP Software | UnityAlgo",
    template: "%s | UnityAlgo",
  },
  description: "UnityAlgo empowers businesses with scalable web solutions, ERPNext implementations, and custom software engineering. Transform your digital presence with our expert team.",
  keywords: ["Software Engineering", "Web Development", "ERPNext", "Karachi", "Digital Transformation", "React", "Next.js", "App Development", "Software", "Web Services", "ERPNext Pakistan", "Software House", "Software Company"],
  authors: [{ name: "UnityAlgo Team" }],
  creator: "UnityAlgo",
  publisher: "UnityAlgo",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    siteName: "UnityAlgo",
    title: "Software Development Company | ERP Software | UnityAlgo",
    description: "UnityAlgo is a technology partner specializing in scalable software systems, ERP software solutions, and enterprise-grade product development",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "UnityAlgo - Empowering Business",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Software Development Company | ERP Software | UnityAlgo",
    description: "We engineer scalable digital ecosystems that drive transformation.",
    images: ["/images/og-image.jpg"],
  },

  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};


const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "UnityAlgo",
  "url": baseUrl,
  "logo": `${baseUrl}/logo.png`,
  "sameAs": [
    "https://www.facebook.com/people/UnityAlgo/61583797718151/",
    "https://www.linkedin.com/company/unityalgo/",
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+92-370-2457703",
    "contactType": "customer service",
    "areaServed": "Global"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <Script
          id="organization-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={cn(poppins.className, poppins.variable, "antialiased bg-background text-foreground")}>
        {children}
      </body>
    </html>
  );
}
