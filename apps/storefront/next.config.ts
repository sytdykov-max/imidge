import type { NextConfig } from "next";
import redirectsMap from "./config/seo-redirects.json";

const nextConfig: NextConfig = {
  async redirects() {
    return redirectsMap.map((entry) => ({
      source: entry.source,
      destination: entry.destination,
      permanent: entry.permanent ?? true,
    }));
  },
};

export default nextConfig;
