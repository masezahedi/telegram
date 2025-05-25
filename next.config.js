/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { 
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
      },
    ],
  },
  webpack: (config, { dev, isServer }) => {
    if (dev && isServer) {
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;