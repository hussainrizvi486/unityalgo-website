import { Metadata } from "next";

const baseUrl = "https://www.unityalgo.com";

interface GeneratePageMetadataArgs {
  title: string;
  description: string;
  keywords: string[];
  path: string;
  ogImage?: string;
}

export function generatePageMetadata({
  title,
  description,
  keywords,
  path,
  ogImage = `${baseUrl}/logo.png`,
}: GeneratePageMetadataArgs): Metadata {
  const url = `${baseUrl}${path}`;

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "UnityAlgo",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export function generateBreadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: `${baseUrl}${item.path}`,
    })),
  };
}
