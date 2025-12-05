import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Performance optimizations
  poweredByHeader: false,
  reactStrictMode: true,

  // External packages
  serverExternalPackages: ['@radix-ui/react-icons'],

  // Image optimization
  images: {
    domains: [
      'your-domain.com',
      'cdn.blinkdotnew.com',
      'api.cron-job.org'
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    dangerouslyAllowSVG: true,
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.ALLOWED_ORIGINS || 'https://your-domain.com'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, PATCH, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          }
        ]
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          }
        ]
      }
    ]
  },

  // Redirects
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/dashboard',
        permanent: true
      }
    ]
  },

  // Environment-specific configuration
  env: {
    NEXT_PUBLIC_SITE_NAME: 'y0',
    NEXT_PUBLIC_ENV_MODE: process.env.NODE_ENV || 'development',
    NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
    NEXT_PUBLIC_BLINK_PROJECT_ID: process.env.NEXT_PUBLIC_BLINK_PROJECT_ID,
    NEXT_PUBLIC_BLINK_AUTH_MODE: process.env.NEXT_PUBLIC_BLINK_AUTH_MODE || 'headless',
    BLINK_API_KEY: process.env.BLINK_API_KEY,
    BLINK_PROJECT_ID: process.env.BLINK_PROJECT_ID,
    CRON_JOB_API_KEY: process.env.CRON_JOB_API_KEY,
    SENTRY_DSN: process.env.SENTRY_DSN,
    ANALYZE_BOOLEAN: process.env.ANALYZE === 'true' ? 'true' : 'false',
  },

  // Output configuration
  output: 'standalone',
  compress: true,
  distDir: '.next',
  trailingSlash: true,

  
  // Bundle analyzer for production builds
  webpack: (config, { buildId, dev, isServer }) => {
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
          reportFilename: 'bundles/report.html',
        })
      )
    }

    return config
  },

  // Production optimizations
  ...(process.env.NODE_ENV === 'production' && {
    poweredByHeader: false,
    reactStrictMode: true,
  })
}

export default nextConfig
