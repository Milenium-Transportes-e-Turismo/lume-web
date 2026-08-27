import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      { source: '/clients', destination: '/registrations', permanent: false },
      { source: '/clients/new', destination: '/registrations/new', permanent: false },
      {
        source: '/clients/:clientId/edit',
        destination: '/registrations/:clientId/edit',
        permanent: false,
      },
      {
        source: '/clients/:clientId',
        destination: '/registrations/:clientId',
        permanent: false,
      },
    ];
  },
  logging: {
    serverFunctions: false,
  },
  experimental: {
    // The authenticated BFF streams individual exports and full Android
    // databases to the Tenant API. The API still enforces the authoritative
    // per-file limit and decrypts the database in private storage.
    proxyClientMaxBodySize: '2048mb',
    serverActions: {
      bodySizeLimit: '51mb',
    },
  },
  transpilePackages: ['jose'],
};

export default nextConfig;
