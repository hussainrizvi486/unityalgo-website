import { Metadata } from 'next';
import { Header, Footer } from '@/components/layouts';
import { AboutContent } from './client';
import Script from 'next/script';

export const metadata: Metadata = {
   title: "UnityAlgo | Software Engineering & ERP Solutions",
   description: "Transform your business with UnityAlgo. We specialize in scalable software engineering and custom ERP solutions to streamline operations and drive digital growth.",
   openGraph: {
      images: ["https://www.unityalgo.com/logo.png"]

   },
   twitter: {
      card: 'summary_large_image',
      title: 'About UnityAlgo',
      description: 'Turning complex operational challenges into seamless digital experiences.',
      images: ["https://www.unityalgo.com/logo.png"],
   },
   keywords: [
      'UnityAlgo',
      'About Us',
      'Software Company',
      'Digital Transformation',
      'ERP Experts',
      'ERP Implementation',
      "ERP Software",
      'Web Development',
      'Karachi Tech',
      'AI Intergration',
      "Artificial Intelligence"
   ],
   alternates: {
      canonical: 'https://unityalgo.com/about-us',
   },
}

const Page = () => {
   const breadcrumbs = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
         {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://www.unityalgo.com"
         },
         {
            "@type": "ListItem",
            "position": 2,
            "name": "About Us",
            "item": "https://www.unityalgo.com/about-us"
         }
      ]
   };
   return (
      <main className="bg-background text-foreground min-h-screen overflow-hidden">
         <Script
            id="breadcrumb-about"
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}>
         </Script>

         <Header />
         <AboutContent />
         <Footer />
      </main>
   );
}

export default Page;