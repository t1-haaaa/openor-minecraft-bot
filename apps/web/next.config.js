/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel is frontend only - never run bot process here
  reactStrictMode: true,
  // No serverless bot execution: API routes only proxy to OPENOR_API
  env: {
    NEXT_PUBLIC_OPENOR_API_URL: process.env.NEXT_PUBLIC_OPENOR_API_URL || "https://api.openor.example",
  },
  // Ensure secrets never leak to client: only NEXT_PUBLIC_ is exposed
  experimental: {
    // isolate bot execution - no background workers on Vercel
  },
};

export default nextConfig;
