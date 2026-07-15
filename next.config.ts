import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // New dealer creation uploads 3 required documents (CNIC front/back, tax
      // certificate) at up to 8MB each via a Server Action — comfortably above
      // Next's 1MB default, which was silently rejecting every submission.
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
