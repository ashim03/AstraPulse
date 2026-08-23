/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverActions: {
    bodySizeLimit: "6mb",
  },
};

export default nextConfig;