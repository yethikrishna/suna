# y0 Enterprise Platform Deployment Guide

This guide covers deployment strategies for the y0 enterprise platform in various environments.

## 🏗️ Deployment Architecture

### Production Environment

```
┌─────────────────────────────────────────────────────────────┐
│                    CDN (Cloudflare/Akamai)                  │
├─────────────────────────────────────────────────────────────┤
│                Load Balancer (HTTPS/HTTP)                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Next.js    │  │   Next.js    │  │    Next.js          │  │
│  │   App #1     │  │   App #2     │  │    App #3           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Redis      │  │  Supabase    │  │    Object Storage   │  │
│  │   Cache      │  │  PostgreSQL  │  │    (S3/GCS)         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│              Monitoring & Logging Stack                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Prometheus  │  │ Grafana      │  │    ELK Stack        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Environment Configuration

### Environment Variables

Create environment-specific configuration files:

#### `.env.production`
```env
# Application
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database
DATABASE_URL="postgresql://user:pass@host:5432/y0_prod"
SUPABASE_URL="https://your-org.supabase.co"
SUPABASE_ANON_KEY="your_production_key"
SUPABASE_SERVICE_ROLE_KEY="your_service_key"

# Redis
REDIS_URL="redis://cluster-endpoint:6379"
REDIS_PASSWORD="your_redis_password"

# Authentication
NEXTAUTH_SECRET="your_production_secret"
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_INTERNAL_URL="http://localhost:3000"

# Analytics & Monitoring
ANALYTICS_API_KEY="your_analytics_key"
SENTRY_DSN="your_sentry_dsn"
LOG_LEVEL="info"

# Email & Notifications
SMTP_HOST="smtp.your-domain.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="noreply@your-domain.com"
SMTP_PASS="your_smtp_password"

# Security
CORS_ORIGIN="https://your-domain.com"
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=900000

# File Storage
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your_aws_key"
AWS_SECRET_ACCESS_KEY="your_aws_secret"
S3_BUCKET="y0-platform-files"

# Backup
BACKUP_ENABLED=true
BACKUP_SCHEDULE="0 2 * * *"
BACKUP_RETENTION_DAYS=30

# Caching
CACHE_TTL_DEFAULT=3600
CACHE_MAX_SIZE=1000000
CACHE_MEMORY_LIMIT=1073741824
```

#### `.env.staging`
```env
NODE_ENV=staging
PORT=3000
DATABASE_URL="postgresql://user:pass@staging-host:5432/y0_staging"
REDIS_URL="redis://staging-redis:6379"
LOG_LEVEL="debug"
# ... other staging-specific variables
```

## 🚀 Deployment Methods

### 1. Docker Deployment

#### Dockerfile
```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Environment variables for build
ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

#### docker-compose.yml
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - redis
      - db
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  db:
    image: postgres:15
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=y0_platform
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  redis_data:
  postgres_data:
```

### 2. Kubernetes Deployment

#### namespace.yaml
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: y0-platform
  labels:
    name: y0-platform
```

#### deployment.yaml
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: y0-platform
  namespace: y0-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: y0-platform
  template:
    metadata:
      labels:
        app: y0-platform
    spec:
      containers:
      - name: y0-platform
        image: y0-platform:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: y0-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: y0-config
              key: redis-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: y0-platform-service
  namespace: y0-platform
spec:
  selector:
    app: y0-platform
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
```

### 3. Vercel Deployment

#### vercel.json
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "regions": ["iad1", "sfo1", "hnd1"],
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "env": {
    "NODE_ENV": "production"
  },
  "build": {
    "env": {
      "NEXT_TELEMETRY_DISABLED": "1"
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-store, must-revalidate"
        }
      ]
    }
  ]
}
```

## 🔒 Security Configuration

### SSL/TLS Setup

#### Nginx Configuration
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📊 Monitoring & Logging

### Prometheus Configuration

#### prometheus.yml
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'y0-platform'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/api/metrics'
    scrape_interval: 30s

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
```

### Grafana Dashboard

Export pre-configured Grafana dashboards for:
- Application performance
- Database metrics
- Redis cache metrics
- Business metrics
- Error rates and latency

## 🔧 Performance Optimization

### Build Optimization

#### next.config.js
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Performance optimizations
  compress: true,
  poweredByHeader: false,

  // Experimental features
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['@mui/material', 'lodash']
  },

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Bundle analyzer for development
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000,
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: -10,
            chunks: 'all',
          },
          components: {
            test: /[\\/]components[\\/]/,
            name: 'components',
            priority: 0,
            chunks: 'all',
          },
        },
      }
    }
    return config
  },
}

module.exports = nextConfig
```

## 🚀 CI/CD Pipeline

### GitHub Actions

#### .github/workflows/deploy.yml
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Production
        run: |
          # Your deployment script here
          echo "Deploying to production..."
```

## 🔄 Database Migration

### Migration Script
```bash
#!/bin/bash

# Production database migration
echo "Starting database migration..."

# Backup current database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migrations
npm run migrate:prod

# Verify migration
npm run migrate:verify

echo "Migration completed successfully!"
```

## 📋 Pre-Deployment Checklist

### Security
- [ ] Environment variables configured correctly
- [ ] SSL/TLS certificates installed
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Database access restricted

### Performance
- [ ] Application optimized for production
- [ ] CDN configured
- [ ] Caching strategy implemented
- [ ] Database indexes optimized
- [ ] Bundle size optimized

### Monitoring
- [ ] Logging configured
- [ ] Error tracking enabled
- [ ] Performance monitoring set up
- [ ] Health checks implemented
- [ ] Alert rules configured

### Backup & Recovery
- [ ] Database backup configured
- [ ] Disaster recovery plan tested
- [ ] Backup encryption enabled
- [ ] Restore procedures documented
- [ ] RPO/RTO objectives met

## 🆘 Troubleshooting

### Common Issues

#### Memory Leaks
```bash
# Monitor memory usage
docker stats

# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096"
```

#### Database Connections
```bash
# Check connection pool
SELECT * FROM pg_stat_activity;

# Kill idle connections
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle';
```

#### Cache Issues
```bash
# Flush Redis cache
redis-cli FLUSHALL

# Monitor Redis memory
redis-cli info memory
```

---

## 📞 Support

For deployment issues:
- **Documentation**: Check this guide and API docs
- **Monitoring**: Check Grafana dashboards and logs
- **Team**: Contact DevOps team via Slack
- **Emergency**: Use on-call rotation procedures

*This deployment guide covers the most common deployment scenarios for the y0 enterprise platform.*