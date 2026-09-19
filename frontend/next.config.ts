import type { NextConfig } from "next";

const backendHttpOrigin = (
  process.env.BACKEND_HTTP_ORIGIN ??
  process.env.NEXT_PUBLIC_BACKEND_HTTP_ORIGIN ??
  "http://localhost:8000"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendHttpOrigin}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
