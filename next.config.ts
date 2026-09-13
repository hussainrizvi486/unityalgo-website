import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  async redirects() {
    return [
      // Sign-in was split across two pages and is now one. Permanent so any
      // bookmark or indexed URL lands on the real page instead of a 404.
      { source: '/admin/login', destination: '/login', permanent: true },
      { source: '/customer/login', destination: '/login', permanent: true },
      // The ERP is named AlgoSuite everywhere now — the database enum always
      // was. Permanent so any indexed /products/unityerp URL passes its
      // ranking to the new path instead of 404ing.
      {
        source: '/products/unityerp',
        destination: '/products/algosuite',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
