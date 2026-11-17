import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le contrat partagé est publié en TypeScript source (imports en « .js » façon NodeNext).
  transpilePackages: ["@buyfit/shared"],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
