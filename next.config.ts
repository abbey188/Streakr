import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to THIS project. A stray package-lock.json in the
  // home directory was making Next infer the wrong root, which breaks file
  // tracing on build/deploy.
  outputFileTracingRoot: __dirname,

  // Type errors FAIL the build. This was previously disabled to tolerate the
  // prototype's `motion` variants (inferred `ease: string`, which is not a valid
  // Easing). Those are annotated now and the repo typechecks clean, so the check
  // is worth enforcing: it already caught a dead `n.type === "group"` branch that
  // could never be true. Left off, an always-red typecheck is one nobody reads.
  //
  // ESLint stays off at build — it isn't configured in this repo yet, so it would
  // fail for an unrelated reason.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Baseline security headers applied to every response. These are safe,
  // content-agnostic hardening (no CSP yet — an enforced Content-Security-Policy
  // needs a source audit of Privy/Solana/image hosts and is a dedicated pass, so
  // it can't break auth or the live app).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Force HTTPS for two years incl. subdomains (Vercel is HTTPS-only).
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // Clickjacking: only same-origin may frame our pages.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Stop MIME-type sniffing.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Don't leak full URLs/paths to other origins.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Disable device features the app doesn't use + opt out of Topics.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
