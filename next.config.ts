import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',  // This exports static HTML/JS files
  trailingSlash: true,
  images: {
    unoptimized: true  // Required for static export
  },
  assetPrefix: process.env.NODE_ENV === 'production' ? '' : '',
};

export default nextConfig;
