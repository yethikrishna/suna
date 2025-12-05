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
    NEXT_PUBLIC_BLINK_AUTH_MODE: process.env.NEXT_PUBLIC_BLINK_AUTH_MODE || 'production',
    BLINK_API_KEY: process.env.BLINK_API_KEY,
    BLINK_PROJECT_ID: process.env.BLINK_PROJECT_ID,
    CRON_JOB_API_KEY: process.env.CRON_JOB_API_KEY,
    SENTRY_DSN: process.env.SENTRY_DSN,
    ANALYZE_BOOLEAN: process.env.ANALYZE === 'true',
  },

  // Output configuration
  output: 'standalone',
  compress: true,
  distDir: '.next',
  trailingSlash: true,

  // Telemetry
  telemetry: false,

  // Bundle analyzer for production builds
  webpack: (config, { buildId, dev, isServer, loadConfig, defaultLoadConfig, webpack }) => {
    const finalConfig = defaultLoadConfig(webpack(config, {
      buildId,
      dev,
      isServer,
      loadConfig,
      webpack
    }))

    if (process.env.ANALYZE_BOOLEAN) {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
      finalConfig.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
          reportFilename: 'bundles/report.html',
        })
      )
    }

    return finalConfig
  },

  // Production optimizations
  ...(process.env.NODE_ENV === 'production' && {
    poweredByHeader: false,
    reactStrictMode: true,
    swcMinify: true,

    // Optimize bundles
    webpack: (config) => {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            enforce: true,
          },
        },
      }

      return config
    }
  })
}

export default nextConfig
