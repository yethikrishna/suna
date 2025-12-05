/**
 * y0 Analytics Provider
 * React provider component for analytics initialization
 */

'use client'

import { useEffect, createContext, useContext, ReactNode, useState } from 'react'
import { analytics, initializeClientAnalytics } from '@/lib/analytics/analytics-engine'

interface AnalyticsContextType {
  isInitialized: boolean
  analytics: typeof analytics
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined)

interface AnalyticsProviderProps {
  children: ReactNode
  enabled?: boolean
  debug?: boolean
  config?: {
    batchSize?: number
    flushInterval?: number
  }
}

export function AnalyticsProvider({
  children,
  enabled = true,
  debug = false,
  config = {}
}: AnalyticsProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    if (!enabled) {
      console.log('[Analytics] Analytics disabled by configuration')
      return
    }

    const initialize = async () => {
      try {
        // Initialize client-side analytics
        initializeClientAnalytics()

        // Initialize analytics engine with config
        const analyticsConfig = {
          enabled: true,
          debug: debug || process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true',
          batchSize: config.batchSize || 100,
          flushInterval: config.flushInterval || 30000
        }

        await analytics.initialize(analyticsConfig)

        // Track app initialization
        analytics.track({
          type: 'system_event' as any,
          category: 'monitoring' as any,
          action: 'app_initialized',
          properties: {
            userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
            url: typeof window !== 'undefined' ? window.location.href : undefined,
            timestamp: new Date().toISOString()
          }
        })

        setIsInitialized(true)

        if (analyticsConfig.debug) {
          console.log('[Analytics] Successfully initialized with config:', analyticsConfig)
        }
      } catch (error) {
        console.error('[Analytics] Failed to initialize:', error)
      }
    }

    initialize()
  }, [enabled, debug, config])

  // Track page visibility changes
  useEffect(() => {
    if (!isInitialized) return

    const handleVisibilityChange = () => {
      analytics.track({
        type: 'user_action' as any,
        category: 'ui' as any,
        action: 'page_visibility_changed',
        properties: {
          hidden: document.hidden,
          visibilityState: document.visibilityState
        }
      })
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isInitialized])

  // Track beforeunload for session end
  useEffect(() => {
    if (!isInitialized) return

    const handleBeforeUnload = () => {
      // Send any pending events before page unload
      analytics.flush().catch(console.error)

      analytics.track({
        type: 'user_action' as any,
        category: 'ui' as any,
        action: 'session_ended',
        properties: {
          duration: Date.now() - performance.now()
        }
      })
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isInitialized])

  const value: AnalyticsContextType = {
    isInitialized,
    analytics
  }

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  )
}

/**
 * Hook to use analytics context
 */
export function useAnalyticsProvider() {
  const context = useContext(AnalyticsContext)
  if (context === undefined) {
    throw new Error('useAnalyticsProvider must be used within an AnalyticsProvider')
  }
  return context
}

/**
 * Hook to check if analytics is available
 */
export function useAnalytics() {
  const context = useContext(AnalyticsContext)
  return context?.analytics
}