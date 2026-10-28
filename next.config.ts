import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Server-only chain and database libraries stay out of the client bundle.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  images: { formats: ["image/avif", "image/webp"] },
};

export default nextConfig;
