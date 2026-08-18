import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "ALLOWALL" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'self' https://devhimanshuu.vercel.app https://*.vercel.app http://localhost:*",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: [
      "lucide-react",
    ],
  },
  serverExternalPackages: [
    "@langchain/langgraph",
    "@modelcontextprotocol/sdk",
    "@prisma/client",
    "prisma",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
