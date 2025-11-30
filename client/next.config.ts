import type { NextConfig } from 'next';

const serverBaseUrl = process.env.SERVER_BASE_URL || 'http://localhost:4000';

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${serverBaseUrl}/:path*` }];
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
