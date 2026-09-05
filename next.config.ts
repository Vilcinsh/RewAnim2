import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.anilist.co',
      },
      {
        protocol: 'https',
        hostname: 'media.kitsu.app',
      },
    ],
  },
};

export default nextConfig;
