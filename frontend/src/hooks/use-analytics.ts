/**
 * y0 Analytics React Hooks
 * React hooks for analytics functionality
 */

'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { analytics, AnalyticsEvent, AnalyticsQuery, Dashboard } from '@/lib/analytics/analytics-engine'

/**
 * Hook to initialize analytics
 */
export function useAnalytics() {
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    analytics.initialize().then(() => {
      setIsInitialized(true)
    }).catch(console.error)
  }, [])

  return { isInitialized, analytics }
}

/**
 * Hook to track page views
 */
export function usePageTracking(path?: string) {
  const { isInitialized } = useAnalytics()
  const previousPath = useRef<string | undefined>()

  useEffect(() => {
    if (!isInitialized) return

    const currentPath = path || (typeof window !== 'undefined' ? window.location.pathname : undefined)

    if (currentPath && currentPath !== previousPath.current) {
      analytics.trackPageView(currentPath)
      previousPath.current = currentPath
    }
  }, [path, isInitialized])
}

/**
 * Hook to track user interactions
 */
export function useEventTracking() {
  const { isInitialized } = useAnalytics()

  const trackEvent = useCallback((event: Omit<AnalyticsEvent, 'timestamp'>) => {
    if (isInitialized) {
      analytics.track(event)
    }
  }, [isInitialized])

  const trackUserAction = useCallback((action: string, category: any, properties?: Record<string, any>) => {
    if (isInitialized) {
      analytics.trackUserAction(action, category, properties)
    }
  }, [isInitialized])

  const trackWorkflowExecution = useCallback((workflowId: string, status: 'started' | 'completed' | 'failed', properties?: Record<string, any>) => {
    if (isInitialized) {
      analytics.trackWorkflowExecution(workflowId, status, properties)
    }
  }, [isInitialized])

  const trackError = useCallback((error: Error, context?: Record<string, any>) => {
    if (isInitialized) {
      analytics.trackError(error, context)
    }
  }, [isInitialized])

  return {
    trackEvent,
    trackUserAction,
    trackWorkflowExecution,
    trackError
  }
}

/**
 * Hook to get real-time analytics data
 */
export function useRealTimeAnalytics(refreshInterval = 30000) {
  const [metrics, setMetrics] = useState({
    activeUsers: 0,
    eventsPerMinute: 0,
    averageResponseTime: 0,
    errorRate: 0,
    topPages: [] as Array<{ page: string; views: number }>
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchMetrics = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await analytics.getRealTimeMetrics()
      setMetrics(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch metrics'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMetrics()

    const interval = setInterval(fetchMetrics, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchMetrics, refreshInterval])

  return { metrics, isLoading, error, refetch: fetchMetrics }
}

/**
 * Hook to query analytics data
 */
export function useAnalyticsQuery(query: AnalyticsQuery) {
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const executeQuery = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const result = await analytics.getAnalyticsData(query)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to execute query'))
    } finally {
      setIsLoading(false)
    }
  }, [query])

  useEffect(() => {
    executeQuery()
  }, [executeQuery])

  return { data, isLoading, error, refetch: executeQuery }
}

/**
 * Hook for dashboard management
 */
export function useAnalytics() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const createDashboard = useCallback(async (dashboardConfig: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setIsLoading(true)
      setError(null)
      const dashboard = await analytics.createDashboard(dashboardConfig)
      setDashboards(prev => [...prev, dashboard])
      return dashboard
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create dashboard'))
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const generateReport = useCallback(async (reportConfig: any) => {
    try {
      setIsLoading(true)
      setError(null)
      const report = await analytics.generateReport(reportConfig)
      return report
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to generate report'))
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    dashboards,
    isLoading,
    error,
    createDashboard,
    generateReport,
    analytics
  }
}

/**
 * Hook to track component performance
 */
export function usePerformanceTracking(componentName: string) {
  const startTime = useRef<number>()
  const { trackEvent } = useEventTracking()

  useEffect(() => {
    startTime.current = performance.now()
  }, [])

  const trackRender = useCallback(() => {
    if (startTime.current) {
      const renderTime = performance.now() - startTime.current
      trackEvent({
        type: 'performance' as any,
        category: 'ui' as any,
        action: 'component_render',
        value: renderTime,
        properties: {
          componentName,
          renderTime
        }
      })
    }
  }, [componentName, trackEvent])

  return { trackRender }
}

/**
 * Hook for A/B testing
 */
export function useABTest(testName: string, variants: string[], weights?: number[]) {
  const [variant, setVariant] = useState<string>('')
  const { trackEvent } = useEventTracking()

  useEffect(() => {
    // Get or assign variant
    const storageKey = `ab_test_${testName}`
    let assignedVariant = ''

    if (typeof window !== 'undefined' && window.localStorage) {
      assignedVariant = window.localStorage.getItem(storageKey) || ''
    }

    if (!assignedVariant) {
      // Assign new variant
      assignedVariant = selectVariant(variants, weights)

      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(storageKey, assignedVariant)
      }

      // Track assignment
      trackEvent({
        type: 'user_action' as any,
        category: 'testing' as any,
        action: 'ab_test_assigned',
        properties: {
          testName,
          variant: assignedVariant
        }
      })
    }

    setVariant(assignedVariant)
  }, [testName, variants, weights, trackEvent])

  const trackConversion = useCallback((conversionType: string, value?: number) => {
    trackEvent({
      type: 'business' as any,
      category: 'testing' as any,
      action: 'ab_test_conversion',
      value,
      properties: {
        testName,
        variant,
        conversionType
      }
    })
  }, [testName, variant, trackEvent])

  return { variant, trackConversion }
}

/**
 * Helper function to select variant based on weights
 */
function selectVariant(variants: string[], weights?: number[]): string {
  if (!weights || weights.length === 0) {
    // Equal probability
    return variants[Math.floor(Math.random() * variants.length)]
  }

  // Weighted selection
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  let random = Math.random() * totalWeight

  for (let i = 0; i < variants.length; i++) {
    random -= weights[i] || 0
    if (random <= 0) {
      return variants[i]
    }
  }

  return variants[variants.length - 1]
}

/**
 * Hook to track form interactions
 */
export function useFormTracking(formName: string) {
  const { trackEvent } = useEventTracking()
  const fieldInteractions = useRef<Set<string>>(new Set())

  const trackFieldInteraction = useCallback((fieldName: string, interactionType: 'focus' | 'blur' | 'change') => {
    if (!fieldInteractions.current.has(`${fieldName}_${interactionType}`)) {
      fieldInteractions.current.add(`${fieldName}_${interactionType}`)

      trackEvent({
        type: 'user_action' as any,
        category: 'forms' as any,
        action: `field_${interactionType}`,
        properties: {
          formName,
          fieldName,
          interactionType
        }
      })
    }
  }, [formName, trackEvent])

  const trackFormSubmission = useCallback((success: boolean, errors?: string[]) => {
    trackEvent({
      type: 'user_action' as any,
      category: 'forms' as any,
      action: 'form_submitted',
      properties: {
        formName,
        success,
        errorCount: errors?.length || 0,
        errors
      }
    })
  }, [formName, trackEvent])

  const trackFormAbandonment = useCallback(() => {
    trackEvent({
      type: 'user_action' as any,
      category: 'forms' as any,
      action: 'form_abandoned',
      properties: {
        formName,
        fieldsInteracted: fieldInteractions.current.size
      }
    })
  }, [formName, trackEvent])

  return {
    trackFieldInteraction,
    trackFormSubmission,
    trackFormAbandonment
  }
}

/**
 * Hook to track feature usage
 */
export function useFeatureTracking(featureName: string) {
  const { trackEvent } = useEventTracking()

  const trackFeatureUsage = useCallback((action: string, properties?: Record<string, any>) => {
    trackEvent({
      type: 'user_action' as any,
      category: 'features' as any,
      action,
      properties: {
        featureName,
        ...properties
      }
    })
  }, [featureName, trackEvent])

  const trackFeatureDiscovery = useCallback(() => {
    trackEvent({
      type: 'user_action' as any,
      category: 'features' as any,
      action: 'feature_discovered',
      properties: {
        featureName
      }
    })
  }, [featureName, trackEvent])

  return {
    trackFeatureUsage,
    trackFeatureDiscovery
  }
}

/**
 * Hook to monitor application health
 */
export function useHealthMonitoring() {
  const [health, setHealth] = useState({
    status: 'healthy' as 'healthy' | 'warning' | 'critical',
    uptime: 0,
    lastCheck: new Date()
  })
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    // Monitor online/offline status
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const trackHealthEvent = useCallback((status: 'healthy' | 'warning' | 'critical', details?: Record<string, any>) => {
    setHealth(prev => ({
      ...prev,
      status,
      lastCheck: new Date()
    }))

    // Track in analytics
    analytics.track({
      type: 'system_event' as any,
      category: 'monitoring' as any,
      action: 'health_check',
      properties: {
        status,
        isOnline,
        ...details
      }
    })
  }, [isOnline])

  return {
    health,
    isOnline,
    trackHealthEvent
  }
}