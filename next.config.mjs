/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ["pg-boss", "pdf-parse", "mammoth", "ollama"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.gravatar.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
