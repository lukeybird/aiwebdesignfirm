/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [],
  },
  async redirects() {
    return [
      {
        source: '/MOGENERGY',
        destination: '/mogenergy',
        permanent: false,
      },
    ];
  },
  experimental: {
    // Helps some uploads; Vercel still caps serverless body ~4.5MB — large ZIPs use Blob client upload.
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
};

module.exports = nextConfig;

