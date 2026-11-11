/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['images.unsplash.com'],
  },
  async redirects() {
    return [
      {
        source: '/produits',
        destination: '/stock',
        permanent: true,
      },
      {
        source: '/produits-stock',
        destination: '/stock',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
