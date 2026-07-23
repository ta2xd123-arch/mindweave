import type { NextConfig } from "next";
import packageJson from "./package.json";

const deploymentId =
  process.env.NEXT_DEPLOYMENT_ID ??
  process.env.VERCEL_DEPLOYMENT_ID ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  "local-development";

const nextConfig: NextConfig = {
  // Keep browser assets and the PWA service worker on the same deployment.
  deploymentId,
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  allowedDevOrigins: ['127.0.0.1', 'localhost', 'localhost.', '::1'],
};

export default nextConfig;
