import type { NextConfig } from "next";

// Every page is per-user (your accounts, budget and forecast), so there is nothing to prerender in full. Instead:
//  - app/(v13)/loading.tsx gives every page an instant skeleton while its data loads, and
//  - the nav links prefetch their whole page (prefetch on <Link>), and staleTimes keeps a prefetched or visited page in the browser
//    for a minute, so a tab change shows its real content at once instead of waiting on the server.
// Anything you change (a server action that calls revalidatePath) clears that cache, so you never see stale figures after an edit.
const nextConfig: NextConfig = {
  experimental: {
    staleTimes: { dynamic: 60, static: 180 },
  },
};

export default nextConfig;
