import type { NextConfig } from "next";

// Every page is per-user (your accounts, budget and forecast), so there is nothing to prerender in full. Instead:
//  - app/(v13)/loading.tsx gives every page an instant skeleton while its data loads, and
//  - staleTimes keeps a page you just visited in the browser for 30 seconds, so switching tabs back and forth is instant.
// Anything you change (a server action that calls revalidatePath) clears that cache, so you never see stale figures after an edit.
const nextConfig: NextConfig = {
  experimental: {
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
