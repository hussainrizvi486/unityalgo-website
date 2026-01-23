import React from 'react';
import { Header, Footer } from '@/components/layouts';
import { MainContent } from './client';
import Script from 'next/script';
import { Metadata } from 'next';


const breadcrumbs = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.unityalgo.com" },
    { "@type": "ListItem", "position": 2, "name": "ERP Software", "item": "https://www.unityalgo.com/services/erp-software" }
  ]
}



export const metadata: Metadata = {
  title: "ERP Implementation & Business Software | UnityAlgo",
  description: "Scale your business with expert ERP implementation and specialized software. We automate finance, HR, and inventory for companies worldwide. Contact us.",
  keywords: [
    "ERPNext Pakistan",
    "ERPNext Karachi",
    "Frappe",
    "ERP Software",
    "ERPNext",
    "Odoo",
    "ERP Implementation Services",
    "ERP Software Karachi",
    "Business Automation Software",
    "Cloud ERP Solutions",
    "ERP Development",
    "Inventory Management System",
    "Financial Management System",
    "Customer Management System",
    "Accounting Software",
    "Point of Sale",
    "UnityAlgo Services"

  ],
  alternates: {
    canonical: 'https://www.unityalgo.com/services/erp-software',
  },
  openGraph: {
    title: "ERP Implementation & Business Software | UnityAlgo",
    description: "Scale your business with expert ERP implementation and specialized software. We automate finance, HR, and inventory for companies worldwide. Contact us.",
    url: 'https://www.unityalgo.com/services/erp-software',
    siteName: 'UnityAlgo',
    images: [
      {
        url: "https://www.unityalgo.com/logo.png",
        width: 1200,
        height: 630,
        alt: "UnityAlgo ERP Software Solutions",
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Expert ERP Implementation Services | UnityAlgo',
    description: 'Transform your business operations with our scalable ERP software solutions.',
    images: ["https://www.unityalgo.com/logo.png"],
  },
}



const Page = () => {
  return (
    <div className="bg-background text-foreground min-h-screen overflow-hidden">
      <Script
        id="erp-software-about"
        type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}>
      </Script>

      <Header />
      <MainContent />
      <Footer />
    </div>
  );
}


export default Page;