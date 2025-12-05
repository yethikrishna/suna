# y0 Analytics Setup Guide

This comprehensive guide covers the setup, configuration, and usage of the y0 platform's advanced analytics and reporting system.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Event Tracking](#event-tracking)
6. [Dashboard Usage](#dashboard-usage)
7. [API Integration](#api-integration)
8. [Custom Reports](#custom-reports)
9. [Performance Monitoring](#performance-monitoring)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)

## Overview

The y0 analytics system provides:

- **Real-time Monitoring**: Live metrics and system health tracking
- **Event Tracking**: Comprehensive user interaction and system event logging
- **Custom Dashboards**: Flexible visualization and reporting
- **Performance Metrics**: API response times and system performance
- **User Analytics**: User behavior and engagement tracking
- **Business Intelligence**: Conversion tracking and funnel analysis
- **A/B Testing**: Built-in experiment tracking
- **Error Monitoring**: Comprehensive error tracking and alerting

## Architecture

### Core Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Apps   │───▶│ Analytics API   │───▶│   Blink SDK     │
│                 │    │                 │    │                 │
│ - React Hooks   │    │ - Event Ingest  │    │ - Storage       │
│ - Auto Tracking │    │ - Query Engine  │    │ - Processing    │
│ - Middleware    │    │ - Reports       │    │ - Analytics     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │   Dashboard UI  │
                                              │                 │
                                              │ - Real-time     │
                                              │ - Charts        │
                                              │ - Reports       │
                                              └─────────────────┘
```

### Data Flow

1. **Event Collection**: Client apps send events via analytics middleware
2. **Event Processing**: Events are validated, enriched, and stored in Blink SDK
3. **Real-time Processing**: Live metrics calculated for dashboard
4. **Query Engine**: Flexible querying and aggregation
5. **Visualization**: Dashboards and reports display insights

## Installation

### Prerequisites

- y0 platform with Blink SDK configured
- Node.js 18+ (for development)
- React 18+ (for client-side tracking)

### Package Dependencies

The analytics system is built into the y0 platform. Additional dependencies include:

```bash
# Chart library for visualizations
npm install recharts

# Already included in y0 platform
# @blinkdotnew/sdk
# next
# react
```

### Environment Configuration

Add these environment variables to your `.env.local`:

```env
# Analytics Configuration
NEXT_PUBLIC_ANALYTICS_ENABLED=true
NEXT_PUBLIC_ANALYTICS_DEBUG=false
NEXT_PUBLIC_ANALYTICS_BATCH_SIZE=100
NEXT_PUBLIC_ANALYTICS_FLUSH_INTERVAL=30000

# Blink SDK Configuration
BLINK_PROJECT_ID=your_project_id
BLINK_API_KEY=your_api_key

# Performance Monitoring
NEXT_PUBLIC_PERFORMANCE_MONITORING=true
```

## Configuration

### Basic Analytics Setup

```typescript
// app/layout.tsx
import { analytics, initializeClientAnalytics } from '@/lib/analytics/analytics-engine'
import { AnalyticsProvider } from '@/components/analytics/analytics-provider'

export default function RootLayout({ children }) {
  useEffect(() => {
    // Initialize client-side analytics
    initializeClientAnalytics()

    // Initialize analytics engine
    analytics.initialize()
  }, [])

  return (
    <AnalyticsProvider>
      {children}
    </AnalyticsProvider>
  )
}
```

### Advanced Configuration

```typescript
// lib/analytics/config.ts
import { analytics, AnalyticsConfig } from '@/lib/analytics/analytics-engine'

const analyticsConfig: AnalyticsConfig = {
  batchSize: 100,
  flushInterval: 30000, // 30 seconds
  enabled: process.env.NODE_ENV !== 'test',
  debug: process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true'
}

// Initialize with custom config
analytics.initialize(analyticsConfig)
```

### Feature Flag Integration

```typescript
// Enable/disable analytics with feature flags
const { flags } = useFeatureFlags(['analytics_enabled'])

if (flags.analytics_enabled) {
  initializeClientAnalytics()
}
```

## Event Tracking

### Automatic Tracking

The system automatically tracks:

- **Page Views**: Route changes and page navigation
- **API Calls**: Request/response times and error rates
- **User Interactions**: Clicks, form submissions, scroll depth
- **Performance**: Page load times, component render times
- **Errors**: JavaScript errors and unhandled rejections

### Manual Event Tracking

```typescript
import { useEventTracking } from '@/hooks/use-analytics'

function MyComponent() {
  const { trackUserAction, trackWorkflowExecution } = useEventTracking()

  const handleButtonClick = () => {
    // Track custom user action
    trackUserAction('button_clicked', 'ui', {
      buttonId: 'submit-form',
      buttonText: 'Submit'
    })
  }

  const handleWorkflowStart = async (workflowId: string) => {
    // Track workflow execution
    trackWorkflowExecution(workflowId, 'started', {
      triggeredBy: 'user_action'
    })

    try {
      await runWorkflow(workflowId)
      trackWorkflowExecution(workflowId, 'completed')
    } catch (error) {
      trackWorkflowExecution(workflowId, 'failed', {
        error: error.message
      })
    }
  }

  return (
    <div>
      <button onClick={handleButtonClick}>Track Action</button>
      <button onClick={() => handleWorkflowStart('workflow-123')}>
        Start Workflow
      </button>
    </div>
  )
}
```

### Component-Level Tracking

```typescript
// Track component performance
function MyComponent() {
  const { trackRender } = usePerformanceTracking('MyComponent')

  useEffect(() => {
    trackRender()
  })

  return <div>Component content</div>
}

// Track form interactions
function ContactForm() {
  const { trackFieldInteraction, trackFormSubmission } = useFormTracking('contact_form')

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      trackFormSubmission(true)
    }}>
      <input
        onFocus={() => trackFieldInteraction('email', 'focus')}
        onChange={() => trackFieldInteraction('email', 'change')}
        name="email"
        type="email"
      />
      <button type="submit">Submit</button>
    </form>
  )
}
```

### A/B Testing

```typescript
function FeatureButton() {
  const { variant, trackConversion } = useABTest(
    'button_color_test',
    ['blue', 'green', 'red'],
    [40, 35, 25] // Weights
  )

  const handleClick = () => {
    trackConversion('button_click')
    // Handle button action
  }

  return (
    <button
      style={{ backgroundColor: variant }}
      onClick={handleClick}
    >
      Click Me ({variant} variant)
    </button>
  )
}
```

## Dashboard Usage

### Real-time Dashboard

The analytics dashboard provides:

- **Live Metrics**: Active users, events per minute, error rates
- **User Activity**: Page views, session duration, user flow
- **Performance Metrics**: API response times, system health
- **Top Content**: Most viewed pages and workflows
- **Event Distribution**: Breakdown by category and type

### Navigation

Access the dashboard by:

1. Click "Analytics" in the sidebar navigation
2. Navigate directly to `/analytics`
3. Use keyboard shortcut (if configured)

### Dashboard Features

- **Time Range Selection**: 1h, 24h, 7d, 30d views
- **Auto-refresh**: Configurable refresh intervals
- **Export Data**: Download analytics data as JSON
- **Responsive Design**: Works on desktop and mobile
- **Real-time Updates**: Live metric updates without page refresh

## API Integration

### Event Tracking API

```typescript
// Track events from server-side
POST /api/analytics/events
{
  "events": [
    {
      "type": "user_action",
      "category": "api",
      "action": "endpoint_called",
      "userId": "user_123",
      "properties": {
        "endpoint": "/api/workflows",
        "method": "POST"
      },
      "value": 150
    }
  ],
  "batch": false
}
```

### Query Analytics API

```typescript
// Query analytics data
GET /api/analytics/events?type=user_action&category=api&limit=100

// With filters
GET /api/analytics/events?filters[0][field]=userId&filters[0][operator]=eq&filters[0][value]=user_123
```

### Reports API

```typescript
// Generate custom report
POST /api/analytics/reports
{
  "name": "User Engagement Report",
  "type": "dashboard",
  "period": "7d",
  "metrics": [
    {
      "name": "active_users",
      "type": "unique_count",
      "field": "userId"
    },
    {
      "name": "page_views",
      "type": "count"
    }
  ],
  "filters": [
    {
      "field": "category",
      "operator": "in",
      "value": ["ui", "workflow"]
    }
  ]
}
```

## Custom Reports

### Creating Custom Dashboards

```typescript
import { useAnalytics } from '@/hooks/use-analytics'

function CustomDashboard() {
  const { createDashboard } = useAnalytics()

  const handleCreateDashboard = async () => {
    const dashboard = await createDashboard({
      name: 'Sales Performance',
      description: 'Track sales metrics and conversion rates',
      isPublic: false,
      ownerId: 'user_123',
      widgets: [
        {
          id: 'widget_1',
          type: 'chart',
          title: 'Revenue Trend',
          query: {
            timeRange: {
              start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              end: new Date()
            },
            metrics: [{ name: 'revenue', type: 'sum', field: 'value' }],
            granularity: 'day'
          },
          visualization: {
            chartType: 'line',
            colors: ['#8884d8']
          },
          position: { x: 0, y: 0 },
          size: { width: 6, height: 4 }
        }
      ],
      layout: {
        columns: 12,
        rowHeight: 100,
        margin: [16, 16],
        containerPadding: [16, 16]
      }
    })

    console.log('Dashboard created:', dashboard.id)
  }

  return (
    <button onClick={handleCreateDashboard}>
      Create Custom Dashboard
    </button>
  )
}
```

### Report Types

1. **Dashboard**: General purpose metrics and visualizations
2. **Funnel**: Conversion funnel analysis
3. **Retention**: User retention and cohort analysis
4. **Performance**: System performance metrics
5. **Usage**: Feature usage and adoption metrics
6. **Revenue**: Financial and billing metrics
7. **Error**: Error tracking and analysis
8. **Custom**: Custom defined reports

## Performance Monitoring

### System Health Monitoring

```typescript
import { PerformanceMonitor } from '@/lib/analytics/analytics-middleware'

// Track database queries
PerformanceMonitor.trackQuery(
  'SELECT * FROM users WHERE id = ?',
  45, // duration in ms
  true // success
)

// Track cache operations
PerformanceMonitor.trackCacheOperation(
  'hit',
  'user:123',
  2 // duration in ms
)

// Manual operation tracking
const spanId = PerformanceMonitor.startSpan('complex_operation', 'data_processing')
// ... perform operation
PerformanceMonitor.endSpan(spanId, { resultCount: 1500 })
```

### Error Tracking

```typescript
import { trackError } from '@/lib/analytics/analytics-middleware'

try {
  await riskyOperation()
} catch (error) {
  trackError(error, {
    operation: 'risky_operation',
    userId: 'user_123',
    context: 'dashboard_load'
  })
}
```

### Real-time Metrics

```typescript
import { useRealTimeAnalytics } from '@/hooks/use-analytics'

function SystemHealth() {
  const { metrics, isLoading } = useRealTimeAnalytics(5000) // 5 second refresh

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      <p>Active Users: {metrics.activeUsers}</p>
      <p>Events/min: {metrics.eventsPerMinute}</p>
      <p>Error Rate: {metrics.errorRate}%</p>
      <p>Avg Response: {metrics.averageResponseTime}ms</p>
    </div>
  )
}
```

## Best Practices

### Event Design

1. **Consistent Naming**: Use clear, consistent event names
2. **Rich Properties**: Include relevant context and metadata
3. **Proper Categories**: Use appropriate event categories
4. **Value Tracking**: Include numeric values when applicable
5. **User Context**: Always include user context when available

```typescript
// Good event design
trackUserAction('purchase_completed', 'business', {
  productId: 'prod_123',
  productCategory: 'electronics',
  purchaseAmount: 99.99,
  currency: 'USD',
  paymentMethod: 'credit_card',
  isFirstPurchase: false
})

// Poor event design
trackUserAction('click', 'ui', { button: 'buy' })
```

### Performance Considerations

1. **Batch Processing**: Use batching to reduce API calls
2. **Selective Tracking**: Track only essential events
3. **Offline Support**: Handle offline scenarios gracefully
4. **Sampling**: Use sampling for high-frequency events
5. **Compression**: Compress event data when possible

### Privacy and Compliance

1. **Data Minimization**: Collect only necessary data
2. **User Consent**: Implement proper consent mechanisms
3. **Data Retention**: Define appropriate retention policies
4. **Anonymization**: Anonymize sensitive data when possible
5. **GDPR Compliance**: Ensure compliance with relevant regulations

```typescript
// Privacy-compliant tracking
trackUserAction('feature_used', 'usage', {
  featureId: 'advanced_search',
  userPlan: 'premium', // Non-identifying
  hasConsent: true
})
```

## Troubleshooting

### Common Issues

#### Events Not Appearing

1. **Check Configuration**: Verify analytics is enabled
2. **Network Issues**: Check API connectivity
3. **Validation Errors**: Check event format
4. **Rate Limiting**: Verify no rate limits are hit
5. **Console Errors**: Check browser console for errors

```typescript
// Debug event tracking
analytics.track({
  type: 'test_event',
  category: 'debug',
  action: 'debugging',
  properties: { timestamp: Date.now() }
})

// Check debug logs
console.log('Analytics enabled:', analytics.isInitialized)
console.log('Pending events:', analytics.events.length)
```

#### Dashboard Not Loading

1. **API Health**: Check if analytics API is responding
2. **Authentication**: Verify user has proper permissions
3. **Data Availability**: Ensure data exists for selected time range
4. **Browser Issues**: Try different browser or clear cache
5. **Network**: Check network connectivity

#### Performance Issues

1. **Event Volume**: Reduce event frequency
2. **Batch Size**: Adjust batch size configuration
3. **Flush Interval**: Optimize flush intervals
4. **Data Queries**: Optimize dashboard queries
5. **Caching**: Implement appropriate caching

### Debug Mode

Enable debug mode for detailed logging:

```typescript
// Enable debug mode
const analyticsConfig = {
  debug: true,
  ...otherConfig
}
analytics.initialize(analyticsConfig)

// Or via environment variable
NEXT_PUBLIC_ANALYTICS_DEBUG=true
```

### Monitoring

Set up monitoring for the analytics system:

```typescript
// Monitor analytics health
setInterval(async () => {
  try {
    const response = await fetch('/api/analytics/health')
    const health = await response.json()

    if (health.status !== 'healthy') {
      console.warn('Analytics system unhealthy:', health)
      // Trigger alert
    }
  } catch (error) {
    console.error('Analytics health check failed:', error)
  }
}, 60000) // Check every minute
```

## Support

For additional support:

1. **Documentation**: Refer to API documentation
2. **Community**: Join the y0 platform community
3. **Issues**: Report bugs on GitHub
4. **Feature Requests**: Submit feature requests
5. **Support**: Contact support team for assistance

---

This setup guide covers the complete analytics system implementation. For specific use cases or advanced configurations, refer to the API documentation or contact the development team.