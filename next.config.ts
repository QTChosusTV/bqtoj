// next.config.ts
import type { NextConfig } from "next";

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net https://va.vercel-scripts.com;
  style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com;
  img-src 'self' blob: data: https:;
  font-src 'self' data: https://cdn.jsdelivr.net https://fonts.gstatic.com;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://codeforces.com https://cdn.jsdelivr.net https://capdashboard.anhwaivo.xyz;
  worker-src 'self' blob:;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
`.replace(/\n/g, "");

const nextConfig: NextConfig = {
  transpilePackages: ["@appletosolutions/reactbits"],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    return config;
  },
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["@monaco-editor/react"],
  },
  // inside nextConfig in next.config.ts
  async redirects() {
    return [
      {
        source: "/problems",
        has: [{ type: "query", key: "id", value: "(?<id>.*)" }],
        destination: "/problems/:id",
        permanent: true,
      },
      {
        source: "/submit",
        has: [{ type: "query", key: "id", value: "(?<id>.*)" }],
        destination: "/submit/:id",
        permanent: true,
      },
      {
        source: "/submission",
        has: [{ type: "query", key: "id", value: "(?<id>.*)" }],
        destination: "/submission/:id",
        permanent: true,
      },
      {
        source: "/contest",
        has: [{ type: "query", key: "id", value: "(?<id>.*)" }],
        destination: "/contest/:id",
        permanent: true,
      },
      {
        source: "/contest-standing",
        has: [{ type: "query", key: "id", value: "(?<id>.*)" }],
        destination: "/contest-standing/:id",
        permanent: true,
      },
      {
        source: "/blog",
        has: [{ type: "query", key: "id", value: "(?<id>.*)" }],
        destination: "/blog/:id",
        permanent: true,
      },
      {
        source: "/user",
        has: [{ type: "query", key: "username", value: "(?<username>.*)" }],
        destination: "/user/:username",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader,
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;