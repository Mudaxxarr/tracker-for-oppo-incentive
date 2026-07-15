import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // New dealer creation uploads 3 required documents (CNIC front/back, tax
      // certificate) at up to 8MB each via a Server Action — comfortably above
      // Next's 1MB default, which was silently rejecting every submission.
      bodySizeLimit: "30mb",
    },
    // Tree-shakes per-icon/per-component imports from these libraries instead
    // of bundling the whole package — recharts especially matters for the
    // Capacitor mobile WebView's initial JS payload.
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
    // Client Router Cache: revisiting a page within this window (back/forward,
    // re-clicking a nav tab, or the Capacitor app resuming from background)
    // shows the last-rendered page instantly, then Next quietly refetches and
    // patches in fresh data - no full-page reload/blank-loading state for a
    // page the user already has. Any Server Action's revalidatePath/Tag call
    // bypasses this immediately regardless of the window, so a save/delete is
    // always reflected right away - this only smooths incidental navigation.
    // Kept short given how often stock/activation figures change here.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
