/**
 * y0 Analytics Middleware
 * Automatic analytics tracking middleware
 */

import { NextRequest, NextResponse } from 'next/server'
import { analytics, EventType, EventCategory } from './analytics-engine'

/**
 * Analytics middleware for Next.js
 * Automatically tracks page views, API calls, and performance metrics
 */
export function analyticsMiddleware(request: NextRequest) {
  const startTime = Date.now()

  // Track API calls
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Don't track analytics API endpoints to avoid infinite loops
    if (!request.nextUrl.pathname.startsWith('/api/analytics')) {
      trackAPICall(request)
    }
  }

  // Create a response interceptor to track completion
  const response = NextResponse.next()

  // Override the response.json method to track responses
  const originalJson = response.json
  response.json = function(data: any, ...args: any[]) {
    const duration = Date.now() - startTime

    // Track API performance
    if (request.nextUrl.pathname.startsWith('/api/')) {
      trackAPIPerformance(request, duration, response.status)
    }

    return originalJson.call(this, data, ...args)
  }

  return response
}

/**
 * Track API call
 */
function trackAPICall(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || undefined
  const referer = request.headers.get('referer') || undefined
  const xForwardedFor = request.headers.get('x-forwarded-for')
  const ip = xForwardedFor?.split(',')[0] || request.ip || undefined

  analytics.track({
    type: EventType.USER_ACTION,
    category: EventCategory.API,
    action: 'api_call_started',
    properties: {
      method: request.method,
      path: request.nextUrl.pathname,
      query: Object.fromEntries(request.nextUrl.searchParams),
      userAgent,
      referer,
      ip
    },
    metadata: {
      userAgent,
      referrer: referer,
      url: request.url,
      ip
    }
  })
}

/**
 * Track API performance
 */
function trackAPIPerformance(request: NextRequest, duration: number, statusCode: number) {
  analytics.track({
    type: EventType.PERFORMANCE,
    category: EventCategory.API,
    action: 'api_call_completed',
    value: duration,
    properties: {
      method: request.method,
      path: request.nextUrl.pathname,
      statusCode,
      success: statusCode < 400,
      clientError: statusCode >= 400 && statusCode < 500,
      serverError: statusCode >= 500
    }
  })
}

/**
 * Track error events
 */
export function trackError(error: Error, context?: Record<string, any>) {
  analytics.track({
    type: EventType.ERROR,
    category: EventCategory.API,
    action: 'error_occurred',
    properties: {
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...context
    }
  })
}

/**
 * Track user authentication events
 */
export function trackAuthEvent(event: 'login' | 'logout' | 'signup' | 'password_reset', userId?: string, properties?: Record<string, any>) {
  analytics.track({
    type: EventType.USER_ACTION,
    category: EventCategory.AUTHENTICATION,
    action: `auth_${event}`,
    userId,
    properties
  })
}

/**
 * Track workflow events
 */
export function trackWorkflowEvent(event: 'started' | 'completed' | 'failed' | 'paused', workflowId: string, userId?: string, properties?: Record<string, any>) {
  analytics.track({
    type: EventType.BUSINESS,
    category: EventCategory.WORKFLOW,
    action: `workflow_${event}`,
    userId,
    properties: {
      workflowId,
      ...properties
    }
  })
}

/**
 * Track cron job events
 */
export function trackCronEvent(event: 'triggered' | 'completed' | 'failed', workflowId: string, cronJobId: string, properties?: Record<string, any>) {
  analytics.track({
    type: EventType.SYSTEM_EVENT,
    category: EventCategory.CRON,
    action: `cron_${event}`,
    properties: {
      workflowId,
      cronJobId,
      ...properties
    }
  })
}

/**
 * Track billing events
 */
export function trackBillingEvent(event: 'subscription_created' | 'subscription_updated' | 'subscription_cancelled' | 'payment_succeeded' | 'payment_failed', userId?: string, properties?: Record<string, any>) {
  analytics.track({
    type: EventType.BUSINESS,
    category: EventCategory.BILLING,
    action: `billing_${event}`,
    userId,
    properties
  })
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static activeSpans = new Map<string, { startTime: number; operation: string }>()

  /**
   * Start tracking an operation
   */
  static startSpan(spanId: string, operation: string): void {
    this.activeSpans.set(spanId, {
      startTime: Date.now(),
      operation
    })
  }

  /**
   * End tracking an operation
   */
  static endSpan(spanId: string, properties?: Record<string, any>): void {
    const span = this.activeSpans.get(spanId)
    if (span) {
      const duration = Date.now() - span.startTime

      analytics.track({
        type: EventType.PERFORMANCE,
        category: EventCategory.MONITORING,
        action: 'operation_completed',
        value: duration,
        properties: {
          operation: span.operation,
          spanId,
          duration,
          ...properties
        }
      })

      this.activeSpans.delete(spanId)
    }
  }

  /**
   * Track database query performance
   */
  static trackQuery(query: string, duration: number, success: boolean): void {
    analytics.track({
      type: EventType.PERFORMANCE,
      category: EventCategory.MONITORING,
      action: 'database_query',
      value: duration,
      properties: {
        query,
        success,
        duration
      }
    })
  }

  /**
   * Track cache performance
   */
  static trackCacheOperation(operation: 'hit' | 'miss' | 'set' | 'delete', key: string, duration?: number): void {
    analytics.track({
      type: EventType.PERFORMANCE,
      category: EventCategory.MONITORING,
      action: 'cache_operation',
      value: duration,
      properties: {
        operation,
        key,
        duration
      }
    })
  }
}

/**
 * Client-side analytics utilities
 */
export function initializeClientAnalytics() {
  // Track page views on route changes
  if (typeof window !== 'undefined') {
    // Track initial page load
    analytics.trackPageView(window.location.pathname, {
      referrer: document.referrer,
      userAgent: navigator.userAgent
    })

    // Track route changes (for Next.js app router)
    let currentPath = window.location.pathname

    // Monitor history API calls
    const originalPushState = history.pushState
    const originalReplaceState = history.replaceState

    history.pushState = function(...args) {
      originalPushState.apply(history, args)
      handleRouteChange()
    }

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args)
      handleRouteChange()
    }

    window.addEventListener('popstate', handleRouteChange)

    function handleRouteChange() {
      if (window.location.pathname !== currentPath) {
        currentPath = window.location.pathname
        analytics.trackPageView(currentPath, {
          referrer: document.referrer,
          userAgent: navigator.userAgent
        })
      }
    }

    // Track scroll depth
    let maxScrollDepth = 0
    const scrollThresholds = [25, 50, 75, 90]
    const triggeredThresholds = new Set<number>()

    window.addEventListener('scroll', () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      const scrollPercentage = Math.round((scrollTop / scrollHeight) * 100)

      if (scrollPercentage > maxScrollDepth) {
        maxScrollDepth = scrollPercentage
      }

      // Track scroll depth milestones
      for (const threshold of scrollThresholds) {
        if (scrollPercentage >= threshold && !triggeredThresholds.has(threshold)) {
          triggeredThresholds.add(threshold)
          analytics.track({
            type: EventType.USER_ACTION,
            category: EventCategory.UI,
            action: 'scroll_depth_reached',
            properties: {
              depth: threshold,
              maxDepth: maxScrollDepth
            }
          })
        }
      }
    })

    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      analytics.track({
        type: EventType.USER_ACTION,
        category: EventCategory.UI,
        action: 'page_visibility_changed',
        properties: {
          visible: !document.hidden,
          state: document.visibilityState
        }
      })
    })

    // Track errors
    window.addEventListener('error', (event) => {
      analytics.track({
        type: EventType.ERROR,
        category: EventCategory.UI,
        action: 'javascript_error',
        properties: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack
        }
      })
    })

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      analytics.track({
        type: EventType.ERROR,
        category: EventCategory.UI,
        action: 'unhandled_promise_rejection',
        properties: {
          reason: event.reason?.toString?.() || String(event.reason)
        }
      })
    })

    // Track page unload
    window.addEventListener('beforeunload', () => {
      analytics.track({
        type: EventType.USER_ACTION,
        category: EventCategory.UI,
        action: 'page_unload',
        properties: {
          maxScrollDepth,
          timeOnPage: Date.now() - performance.now()
        }
      })
    })
  }
}

/**
 * Create analytics wrapper for API routes
 */
export function createAnalyticsWrapper(handler: Function) {
  return async (request: NextRequest, ...args: any[]) => {
    const spanId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    PerformanceMonitor.startSpan(spanId, `${request.method} ${request.nextUrl.pathname}`)

    try {
      const result = await handler(request, ...args)
      PerformanceMonitor.endSpan(spanId, {
        success: true,
        status: result?.status
      })
      return result
    } catch (error) {
      PerformanceMonitor.endSpan(spanId, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      trackError(error instanceof Error ? error : new Error('Unknown API error'), {
        method: request.method,
        path: request.nextUrl.pathname
      })

      throw error
    }
  }
}