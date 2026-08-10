import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Stable in Next.js 15.5+ (was previously experimental.typedRoutes).
  typedRoutes: true,
  experimental: {
    serverActions: {
      // Batch ZIP/PDF history uploads can exceed the default 1 MB limit.
      bodySizeLimit: '100mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
