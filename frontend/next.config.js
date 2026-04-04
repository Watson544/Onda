/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silence workspace root warning (monorepo with separate backend package.json)
  turbopack: { root: __dirname },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};

module.exports = nextConfig;
