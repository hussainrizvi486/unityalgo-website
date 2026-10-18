import type { NextConfig } from "next";
import { IMAGE_HOSTS } from "./lib/image-hosts";

const isDev = process.env.NODE_ENV !== "production";

function origin(value: string | undefined) {
  try {
    return value ? new URL(value).origin : "";
  } catch {
    return "";
  }
}

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://cdn.paddle.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.paddle.com ${origin(process.env.NEXT_PUBLIC_CONTROLLER_WS_URL)} ${isDev ? "ws://localhost:* ws://127.0.0.1:*" : ""}`.trim(),
  "frame-src https://*.paddle.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: IMAGE_HOSTS.map((hostname) => ({ protocol: 'https' as const, hostname })),
  },

  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        source: '/uploads/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },

  async redirects() {
    return [
      { source: '/admin/login', destination: '/login', permanent: true },
      { source: '/customer/login', destination: '/login', permanent: true },
      {
        source: '/products/unityerp',
        destination: '/products/algosuite',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
