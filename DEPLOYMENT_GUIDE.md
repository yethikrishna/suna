# y0 Production Deployment Guide

## 🚀 Production Deployment Guide

This guide covers the complete deployment process for the y0 platform in a production environment.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Blink SDK Configuration](#blink-sdk-configuration)
4. [Cron Jobs Setup](#cron-jobs-setup)
5. [Deployment Platforms](#deployment-platforms)
6. [Security Configuration](#security-configuration)
7. [Monitoring Setup](#monitoring-setup)
8. [Performance Optimization](#performance-optimization)
9. [Backup Strategy](#backup-strategy)
10. [Troubleshooting](#troubleshooting)

---

## 📋 Prerequisites

### Required Accounts
- **Blink SDK Account**: [blinkdotnew.com](https://blinkdotnew.com)
- **Domain Name**: For production URL
- **Version Control**: Git repository with your code
- **CI/CD Pipeline**: (Recommended) GitHub Actions, GitLab CI, etc.

### Required Tools
- **Node.js**: Version 18.0 or higher
- **npm**: Version 9.0 or higher
- **Git**: For version control

---

## 🔧 Environment Setup

### 1. Clone Repository
```bash
git clone <your-repository-url>
cd suna
```

### 2. Install Dependencies
```bash
cd frontend
npm install
```

### 3. Environment Variables
Create `.env.local` with the following variables:

```bash
# Application Configuration
NEXT_PUBLIC_ENV_MODE="production"
NEXT_PUBLIC_URL="https://your-domain.com"
NEXT_PUBLIC_BLINK_PROJECT_ID="your_blink_project_id"
NEXT_PUBLIC_BLINK_AUTH_MODE="production"

# Blink SDK
BLINK_API_KEY="your_blink_api_key"
BLINK_PROJECT_ID="your_blink_project_id"

# Cron Jobs (Optional)
CRON_JOB_API_KEY="your_cron_job_api_key"

# OpenAI (for AI features)
OPENAI_API_KEY="your_openai_api_key"

# Monitoring (Optional)
SENTRY_DSN="your_sentry_dsn"
```

### 4. Verify Configuration
```bash
npm run build
npm run start
```

---

## ⚡ Blink SDK Configuration

### 1. Create Blink SDK Project
1. Visit [blinkdotnew.com](https://blinkdotnew.com)
2. Create a new project
3. Get your API keys and project ID
4. Configure your project settings

### 2. Initialize Blink SDK Client
Update `frontend/src/lib/blink/client.ts`:

```typescript
import { createBlinkClient } from '@blinkdotnew/sdk'

export const blink = createBlinkClient({
  projectId: process.env.BLINK_PROJECT_ID,
  apiKey: process.env.BLINK_API_KEY,
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'development'
})
```

### 3. Test Blink SDK Integration
```bash
npm run test:integration:blink
```

---

## 🕒 Cron Jobs Setup

### 1. Create Cron-Job.org Account
1. Visit [cron-job.org](https://cron-job.org)
2. Create a free account
3. Navigate to API settings
4. Generate API key

### 2. Configure Webhook Endpoint
Your production domain must be accessible for webhooks:

```bash
# Test webhook endpoint
curl -X POST https://your-domain.com/api/cron/webhook/test-workflow-id \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### 3. Verify Cron Integration
```bash
npm run test:cron-integration
```

---

## 🌐 Deployment Platforms

### 1. Vercel (Recommended)

#### Install Vercel CLI
```bash
npm i -g vercel
```

#### Deploy to Vercel
```bash
vercel --prod
```

#### Vercel Configuration
Create `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "env": {
    "NEXT_PUBLIC_ENV_MODE": "production",
    "NEXT_PUBLIC_BLINK_PROJECT_ID": "@blink_project_id",
    "BLINK_API_KEY": "@blink_api_key",
    "CRON_JOB_API_KEY": "@cron_job_api_key"
  }
}
```

### 2. Netlify

#### Build and Deploy
```bash
npm run build
npm run start
```

#### Netlify Configuration
Create `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "out"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

### 3. Railway

#### Deploy to Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### 4. DigitalOcean App Platform

#### Deploy to DO
1. Create App in DigitalOcean Control Panel
2. Connect your GitHub repository
3. Configure build command: `npm run build`
4. Configure run command: `npm run start`
5. Add environment variables

---

## 🔒 Security Configuration

### 1. Environment Variables Security
```bash
# Never commit secrets to version control
echo ".env.local" >> .gitignore
echo ".env.production" >> .gitignore
```

### 2. CORS Configuration
Update `next.config.ts`:
```typescript
const nextConfig = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: process.env.ALLOWED_ORIGINS || 'https://your-domain.com' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ]
  },
}
```

### 3. Rate Limiting
Add rate limiting to API routes:
```typescript
// middleware.ts
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
})
```

### 4. HTTPS Enforcement
Ensure all production deployments use HTTPS:

#### Vercel (Automatic)
HTTPS is automatically enabled.

#### Custom Domain
```bash
# Install SSL certificate
certbot --nginx -d your-domain.com
```

---

## 📊 Monitoring Setup

### 1. Application Monitoring

#### Built-in Monitoring
- Navigate to `/monitoring` in your deployed application
- Monitor system health and performance
- Set up alert conditions

#### External Monitoring (Optional)
```bash
# Install monitoring packages
npm install @sentry/nextjs @sentry/tracing
```

Configure Sentry in `next.config.ts`:
```typescript
const { withSentryConfig } = require('@sentry/nextjs')

module.exports = withSentryConfig({
  org: 'your-org',
  project: 'your-project',
})
```

### 2. Error Tracking
```typescript
// sentry.client.config.js
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
})
```

### 3. Performance Monitoring
```typescript
// performance.config.ts
export const performanceConfig = {
  sampleRate: 0.1, // Sample 10% of requests
  tracesSampleRate: 0.1,
}
```

---

## ⚡ Performance Optimization

### 1. Build Optimization

#### Package.json Scripts
```json
{
  "scripts": {
    "build": "next build",
    "build:analyze": "ANALYZE=true next build",
    "build:export": "next build && next export",
    "start": "next start",
    "start:production": "NODE_ENV=production next start"
  }
}
```

### 2. Image Optimization
```typescript
// next.config.ts
const nextConfig = {
  images: {
    domains: ['your-domain.com', 'cdn.example.com'],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },
}
```

### 3. Caching Strategy
```typescript
// lib/cache.ts
export const cacheConfig = {
  apiRoutes: {
    '/api/workflows': { maxAge: 60 }, // 1 minute
    '/api/agents': { maxAge: 300 }, // 5 minutes
    '/api/cron/stats': { maxAge: 60 }, // 1 minute
  },
}
```

---

## 💾 Backup Strategy

### 1. Data Backup
Since y0 uses Blink SDK for data storage, your data is automatically backed up. However, you should:

#### Export Critical Data
```bash
# Export workflows and agents
npm run export:config
```

#### Configuration Backup
```bash
# Backup configuration files
tar -czf backup-$(date +%Y%m%d).tar.gz .env.local vercel.json netlify.toml
```

### 2. Recovery Planning
- Maintain offline backups of configuration
- Document recovery procedures
- Test recovery process regularly

---

## 🔍 Troubleshooting

### Common Issues

#### 1. Build Failures
```bash
# Clear build cache
rm -rf .next
npm run build
```

#### 2. API Connection Issues
```bash
# Test Blink SDK connection
curl -H "Authorization: Bearer $BLINK_API_KEY" \
  https://api.blinkdotnew.com/health
```

#### 3. Cron Job Not Triggering
```bash
# Test webhook endpoint
curl -X POST https://your-domain.com/api/cron/webhook/test-workflow-id \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

#### 4. Performance Issues
```bash
# Analyze bundle size
npm run build:analyze
```

### Debug Mode
Enable debug logging:
```bash
DEBUG=y0:* npm run start
```

### Health Checks
```bash
# Application health check
curl https://your-domain.com/api/health

# Cron webhook health check
curl -X POST https://your-domain.com/api/cron/webhook/test-workflow-id \
  -H "Content-Type: application/json" \
  -d '{"health": true}'
```

---

## 📋 Deployment Checklist

### Pre-Deployment Checklist
- [ ] Environment variables configured
- [ ] Blink SDK project set up
- [ ] Cron job account created
- [ ] Domain name configured
- [ ] SSL certificate installed
- [ ] Monitoring enabled
- [ ] Error tracking configured
- [ ] Performance tests passed

### Post-Deployment Checklist
- [ ] Application loads correctly
- [ ] Authentication works
- [ ] Blink SDK integration functional
- [ ] Cron jobs trigger correctly
- [ ] Monitoring dashboard active
- [ ] Error reporting working
- [ ] Performance within acceptable limits

---

## 🎯 Production Best Practices

### 1. Security
- Use environment variables for all secrets
- Enable HTTPS for all traffic
- Implement rate limiting
- Regularly update dependencies
- Monitor for security vulnerabilities

### 2. Performance
- Optimize images and assets
- Implement caching strategies
- Monitor bundle size
- Use CDN for static assets
- Regular performance audits

### 3. Reliability
- Implement health checks
- Set up monitoring alerts
- Create backup procedures
- Test disaster recovery
- Document all processes

### 4. Maintenance
- Regular dependency updates
- Monitor system health
- Review and rotate secrets
- Analyze performance trends
- Update documentation

---

## 📞 Support

### Documentation Resources
- [Blink SDK Documentation](https://docs.blinkdotnew.com)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Cron-Job.org API Docs](https://cron-job.org/api)

### Community Support
- GitHub Issues: Report bugs and feature requests
- Discord: Real-time community support
- Documentation: Contribute to knowledge base

### Emergency Contacts
- Platform Status: Check monitoring dashboard
- Support Email: support@your-domain.com
- Emergency Contacts: Documented internally

---

**🎉 Your y0 platform is now ready for production deployment!**

Follow this guide carefully to ensure a smooth and successful deployment. Remember to test thoroughly and monitor closely after going live.