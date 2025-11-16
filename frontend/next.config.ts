import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig = {
  env: {
    NEXT_PUBLIC_SITE_NAME: 'Yeti',
  },
};

/** Removing Sentry for now */
if (false && process.env.NEXT_PUBLIC_VERCEL_ENV === 'production') {
  nextConfig = withSentryConfig(nextConfig, {
    org: 'kortix-ai',
    project: 'suna-nextjs',
    silent: !process.env.CI,
    widenClientFileUpload: true,
    tunnelRoute: '/monitoring',
    disableLogger: true,
    automaticVercelMonitors: true,
  });
}

export default nextConfig;
