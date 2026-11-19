import type { NextConfig } from "next";

// Every page here is per-user and dynamic (login, plans), so Cache Components
// (opt-in prerendering with Suspense boundaries) would add work for no benefit.
const nextConfig: NextConfig = {};

export default nextConfig;
