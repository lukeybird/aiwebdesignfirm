const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent Next from picking a parent lockfile (e.g. ~/package-lock.json) as the app root,
  // which can break /public static assets like /TDG/portraits/*.
  outputFileTracingRoot: path.join(__dirname),
  async rewrites() {
    return [{ source: '/TDG', destination: '/TDG/index.html' }];
  },
  images: {
    domains: [],
  },
  experimental: {
    // Helps some uploads; Vercel still caps serverless body ~4.5MB — large ZIPs use Blob client upload.
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
};

module.exports = nextConfig;

