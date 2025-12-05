/**
 * y0 Analytics Engine
 * Comprehensive analytics and reporting system
 */

import { blink } from '@/lib/blink/client'

export interface AnalyticsEvent {
  id?: string
  type: EventType
  category: EventCategory
  action: string
  userId?: string
  sessionId?: string
  properties?: Record<string, any>
  timestamp: Date
  value?: number
  metadata?: {
    userAgent?: string
    ip?: string
    referrer?: string
    url?: string
    country?: string
    device?: string
    browser?: string
    os?: string
  }
}

export enum EventType {
  PAGE_VIEW = 'page_view',
  USER_ACTION = 'user_action',
  SYSTEM_EVENT = 'system_event',
  ERROR = 'error',
  PERFORMANCE = 'performance',
  BUSINESS = 'business',
  SECURITY = 'security'
}

export enum EventCategory {
  AUTHENTICATION = 'authentication',
  WORKFLOW = 'workflow',
  AGENT = 'agent',
  API = 'api',
  UI = 'ui',
  BILLING = 'billing',
  MONITORING = 'monitoring',
  CRON = 'cron'
}

export interface AnalyticsReport {
  id: string
  name: string
  type: ReportType
  period: ReportPeriod
  metrics: ReportMetric[]
  filters: ReportFilter[]
  createdAt: Date
  updatedAt: Date
  data?: any
  isScheduled: boolean
  scheduleConfig?: ScheduleConfig
}

export enum ReportType {
  DASHBOARD = 'dashboard',
  FUNNEL = 'funnel',
  RETENTION = 'retention',
  PERFORMANCE = 'performance',
  USAGE = 'usage',
  REVENUE = 'revenue',
  ERROR = 'error',
  CUSTOM = 'custom'
}

export enum ReportPeriod {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  CUSTOM = 'custom'
}

export interface ReportMetric {
  name: string
  type: 'count' | 'sum' | 'average' | 'percentage' | 'unique_count'
  field?: string
  aggregation?: string
}

export interface ReportFilter {
  field: string
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in'
  value: any
}

export interface ScheduleConfig {
  frequency: 'daily' | 'weekly' | 'monthly'
  time: string // HH:MM format
  timezone: string
  recipients: string[]
}

export interface Dashboard {
  id: string
  name: string
  description?: string
  widgets: Widget[]
  layout: DashboardLayout
  filters: ReportFilter[]
  createdAt: Date
  updatedAt: Date
  isPublic: boolean
  ownerId: string
}

export interface Widget {
  id: string
  type: WidgetType
  title: string
  query: AnalyticsQuery
  visualization: VisualizationConfig
  position: WidgetPosition
  size: WidgetSize
  refreshInterval?: number
}

export enum WidgetType {
  CHART = 'chart',
  TABLE = 'table',
  METRIC = 'metric',
  FUNNEL = 'funnel',
  HEATMAP = 'heatmap',
  MAP = 'map',
  LIST = 'list'
}

export interface AnalyticsQuery {
  metrics: ReportMetric[]
  dimensions?: string[]
  filters?: ReportFilter[]
  timeRange: {
    start: Date
    end: Date
  }
  granularity?: 'minute' | 'hour' | 'day' | 'week' | 'month'
}

export interface VisualizationConfig {
  chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'gauge'
  colors?: string[]
  showLegend?: boolean
  showAxes?: boolean
  maxDataPoints?: number
  groupBy?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface WidgetPosition {
  x: number
  y: number
}

export interface WidgetSize {
  width: number
  height: number
}

export interface DashboardLayout {
  columns: number
  rowHeight: number
  margin: [number, number]
  containerPadding: [number, number]
}

/**
 * Analytics Engine Class
 */
class AnalyticsEngine {
  private events: AnalyticsEvent[] = []
  private isInitialized = false
  private config: AnalyticsConfig

  constructor(config: AnalyticsConfig = {}) {
    this.config = {
      batchSize: 100,
      flushInterval: 30000, // 30 seconds
      enabled: true,
      debug: false,
      ...config
    }
  }

  /**
   * Initialize the analytics engine
   */
  async initialize(): Promise<void> {
    try {
      // Load existing events from storage
      await this.loadStoredEvents()

      // Start periodic flush
      this.startPeriodicFlush()

      this.isInitialized = true

      if (this.config.debug) {
        console.log('[Analytics] Initialized successfully')
      }
    } catch (error) {
      console.error('[Analytics] Initialization failed:', error)
      throw error
    }
  }

  /**
   * Track an analytics event
   */
  track(event: Omit<AnalyticsEvent, 'timestamp'>): void {
    if (!this.isInitialized || !this.config.enabled) {
      return
    }

    const fullEvent: AnalyticsEvent = {
      ...event,
      timestamp: new Date(),
      id: this.generateEventId(),
      metadata: {
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        ...event.metadata
      }
    }

    this.events.push(fullEvent)

    // Flush if batch size reached
    if (this.events.length >= this.config.batchSize!) {
      this.flush().catch(console.error)
    }
  }

  /**
   * Track page view
   */
  trackPageView(path: string, properties?: Record<string, any>): void {
    this.track({
      type: EventType.PAGE_VIEW,
      category: EventCategory.UI,
      action: 'page_view',
      properties: {
        path,
        title: typeof document !== 'undefined' ? document.title : undefined,
        ...properties
      }
    })
  }

  /**
   * Track user action
   */
  trackUserAction(action: string, category: EventCategory, properties?: Record<string, any>): void {
    this.track({
      type: EventType.USER_ACTION,
      category,
      action,
      properties
    })
  }

  /**
   * Track workflow execution
   */
  trackWorkflowExecution(workflowId: string, status: 'started' | 'completed' | 'failed', properties?: Record<string, any>): void {
    this.track({
      type: EventType.BUSINESS,
      category: EventCategory.WORKFLOW,
      action: `workflow_${status}`,
      properties: {
        workflowId,
        status,
        ...properties
      }
    })
  }

  /**
   * Track API performance
   */
  trackAPIPerformance(endpoint: string, method: string, duration: number, statusCode: number): void {
    this.track({
      type: EventType.PERFORMANCE,
      category: EventCategory.API,
      action: 'api_call',
      value: duration,
      properties: {
        endpoint,
        method,
        statusCode,
        success: statusCode < 400
      }
    })
  }

  /**
   * Track error
   */
  trackError(error: Error, context?: Record<string, any>): void {
    this.track({
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
   * Generate analytics report
   */
  async generateReport(reportConfig: Omit<AnalyticsReport, 'id' | 'createdAt' | 'updatedAt'>): Promise<AnalyticsReport> {
    const report: AnalyticsReport = {
      ...reportConfig,
      id: this.generateReportId(),
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Generate report data based on type
    report.data = await this.generateReportData(report)

    // Store report in database
    try {
      if (blink.db.analyticsReports) {
        await blink.db.analyticsReports.create({
          ...report,
          data: report.data,
          createdAt: report.createdAt.toISOString(),
          updatedAt: report.updatedAt.toISOString()
        })
      }
    } catch (error) {
      console.error('[Analytics] Failed to store report:', error)
    }

    return report
  }

  /**
   * Create dashboard
   */
  async createDashboard(dashboardConfig: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): Promise<Dashboard> {
    const dashboard: Dashboard = {
      ...dashboardConfig,
      id: this.generateDashboardId(),
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Store dashboard in database
    try {
      if (blink.db.dashboards) {
        await blink.db.dashboards.create({
          ...dashboard,
          createdAt: dashboard.createdAt.toISOString(),
          updatedAt: dashboard.updatedAt.toISOString()
        })
      }
    } catch (error) {
      console.error('[Analytics] Failed to store dashboard:', error)
    }

    return dashboard
  }

  /**
   * Get analytics data for widgets
   */
  async getAnalyticsData(query: AnalyticsQuery): Promise<any> {
    try {
      // Build analytics query for Blink SDK
      const timeFilter = {
        timestamp: {
          gte: query.timeRange.start.toISOString(),
          lte: query.timeRange.end.toISOString()
        }
      }

      const filters = [
        timeFilter,
        ...(query.filters || []).map(filter => ({
          [filter.field]: this.buildFilterValue(filter)
        }))
      ]

      // Query analytics events
      const events = await this.queryEvents(filters)

      // Process metrics
      return this.processMetrics(events, query.metrics, query.dimensions, query.granularity)

    } catch (error) {
      console.error('[Analytics] Failed to get analytics data:', error)
      throw error
    }
  }

  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics(): Promise<{
    activeUsers: number
    eventsPerMinute: number
    averageResponseTime: number
    errorRate: number
    topPages: Array<{ page: string; views: number }>
  }> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

    try {
      const recentEvents = await this.queryEvents([
        {
          timestamp: { gte: fiveMinutesAgo.toISOString() }
        }
      ])

      const activeUsers = new Set(recentEvents.filter(e => e.userId).map(e => e.userId)).size
      const errorEvents = recentEvents.filter(e => e.type === EventType.ERROR)
      const pageViews = recentEvents.filter(e => e.type === EventType.PAGE_VIEW)

      const topPages = pageViews.reduce((acc, event) => {
        const page = event.properties?.path || '/'
        acc[page] = (acc[page] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return {
        activeUsers,
        eventsPerMinute: Math.round(recentEvents.length / 5),
        averageResponseTime: 0, // Would need performance events
        errorRate: recentEvents.length > 0 ? Math.round((errorEvents.length / recentEvents.length) * 100) : 0,
        topPages: Object.entries(topPages)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([page, views]) => ({ page, views }))
      }
    } catch (error) {
      console.error('[Analytics] Failed to get real-time metrics:', error)
      return {
        activeUsers: 0,
        eventsPerMinute: 0,
        averageResponseTime: 0,
        errorRate: 0,
        topPages: []
      }
    }
  }

  /**
   * Private methods
   */

  private async loadStoredEvents(): Promise<void> {
    try {
      // Load events from local storage or database
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem('analytics_events')
        if (stored) {
          this.events = JSON.parse(stored).map((e: any) => ({
            ...e,
            timestamp: new Date(e.timestamp)
          }))
        }
      }
    } catch (error) {
      console.error('[Analytics] Failed to load stored events:', error)
    }
  }

  private startPeriodicFlush(): void {
    if (this.config.flushInterval) {
      setInterval(() => {
        this.flush().catch(console.error)
      }, this.config.flushInterval)
    }
  }

  private async flush(): Promise<void> {
    if (this.events.length === 0) {
      return
    }

    const eventsToFlush = [...this.events]
    this.events = []

    try {
      // Store events in Blink database
      if (blink.db.analyticsEvents) {
        await blink.db.analyticsEvents.createMany(
          eventsToFlush.map(event => ({
            ...event,
            timestamp: event.timestamp.toISOString()
          }))
        )
      }

      // Also store in local storage as backup
      if (typeof window !== 'undefined' && window.localStorage) {
        const existing = window.localStorage.getItem('analytics_events') || '[]'
        const allEvents = [...JSON.parse(existing), ...eventsToFlush]
        window.localStorage.setItem('analytics_events', JSON.stringify(allEvents))
      }

      if (this.config.debug) {
        console.log(`[Analytics] Flushed ${eventsToFlush.length} events`)
      }
    } catch (error) {
      console.error('[Analytics] Failed to flush events:', error)
      // Put events back in the array for retry
      this.events.unshift(...eventsToFlush)
    }
  }

  private async queryEvents(filters: any[]): Promise<AnalyticsEvent[]> {
    try {
      // Query from Blink database or fallback to stored events
      if (blink.db.analyticsEvents && typeof blink.db.analyticsEvents.findMany === 'function') {
        const dbEvents = await blink.db.analyticsEvents.findMany({
          where: { AND: filters },
          orderBy: { timestamp: 'desc' },
          take: 10000
        })

        return dbEvents.map((event: any) => ({
          ...event,
          timestamp: new Date(event.timestamp)
        }))
      } else {
        // Fallback to in-memory events
        return this.events.filter(event => {
          return filters.every(filter => {
            const [field, condition] = Object.entries(filter)[0]
            const value = this.getNestedValue(event, field)
            return this.matchesCondition(value, condition)
          })
        })
      }
    } catch (error) {
      console.error('[Analytics] Failed to query events:', error)
      return []
    }
  }

  private processMetrics(events: AnalyticsEvent[], metrics: ReportMetric[], dimensions?: string[], granularity?: string): any {
    const result: any = {}

    for (const metric of metrics) {
      switch (metric.type) {
        case 'count':
          result[metric.name] = events.length
          break
        case 'sum':
          result[metric.name] = events.reduce((sum, event) => sum + (event.value || 0), 0)
          break
        case 'average':
          const values = events.map(e => e.value || 0).filter(v => v > 0)
          result[metric.name] = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0
          break
        case 'unique_count':
          const uniqueField = metric.field || 'userId'
          const uniqueValues = new Set(events.map(e => this.getNestedValue(e, uniqueField)).filter(Boolean))
          result[metric.name] = uniqueValues.size
          break
        case 'percentage':
          const total = events.length
          const matching = events.filter(e => {
            if (metric.field) {
              const value = this.getNestedValue(e, metric.field!)
              return value === true || value === 'true'
            }
            return false
          }).length
          result[metric.name] = total > 0 ? (matching / total) * 100 : 0
          break
      }
    }

    // Add dimension grouping if specified
    if (dimensions && dimensions.length > 0) {
      result.byDimension = {}

      for (const dimension of dimensions) {
        const groups = events.reduce((acc, event) => {
          const key = this.getNestedValue(event, dimension) || 'unknown'
          if (!acc[key]) acc[key] = []
          acc[key].push(event)
          return acc
        }, {} as Record<string, AnalyticsEvent[]>)

        result.byDimension[dimension] = Object.entries(groups).map(([key, groupEvents]) => ({
          [dimension]: key,
          ...this.processMetrics(groupEvents, metrics, [], granularity)
        }))
      }
    }

    return result
  }

  private async generateReportData(report: AnalyticsReport): Promise<any> {
    const timeRange = this.getTimeRangeForPeriod(report.period)

    const query: AnalyticsQuery = {
      metrics: report.metrics,
      filters: report.filters,
      timeRange,
      granularity: this.getGranularityForPeriod(report.period)
    }

    return await this.getAnalyticsData(query)
  }

  private getTimeRangeForPeriod(period: ReportPeriod): { start: Date; end: Date } {
    const end = new Date()
    const start = new Date()

    switch (period) {
      case ReportPeriod.DAILY:
        start.setDate(start.getDate() - 1)
        break
      case ReportPeriod.WEEKLY:
        start.setDate(start.getDate() - 7)
        break
      case ReportPeriod.MONTHLY:
        start.setMonth(start.getMonth() - 1)
        break
      case ReportPeriod.QUARTERLY:
        start.setMonth(start.getMonth() - 3)
        break
      case ReportPeriod.YEARLY:
        start.setFullYear(start.getFullYear() - 1)
        break
      default:
        start.setDate(start.getDate() - 7) // Default to weekly
    }

    return { start, end }
  }

  private getGranularityForPeriod(period: ReportPeriod): string {
    switch (period) {
      case ReportPeriod.HOURLY:
        return 'minute'
      case ReportPeriod.DAILY:
        return 'hour'
      case ReportPeriod.WEEKLY:
        return 'day'
      case ReportPeriod.MONTHLY:
        return 'day'
      case ReportPeriod.QUARTERLY:
        return 'week'
      case ReportPeriod.YEARLY:
        return 'month'
      default:
        return 'day'
    }
  }

  private buildFilterValue(filter: ReportFilter): any {
    switch (filter.operator) {
      case 'in':
      case 'not_in':
        return { [filter.operator]: filter.value }
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
        return { [filter.operator]: filter.value }
      default:
        return { [filter.operator]: filter.value }
    }
  }

  private matchesCondition(value: any, condition: any): boolean {
    if (typeof condition === 'object' && condition !== null) {
      const [operator, operand] = Object.entries(condition)[0]
      switch (operator) {
        case 'gt':
          return value > operand
        case 'gte':
          return value >= operand
        case 'lt':
          return value < operand
        case 'lte':
          return value <= operand
        case 'in':
          return Array.isArray(operand) && operand.includes(value)
        case 'not_in':
          return Array.isArray(operand) && !operand.includes(value)
        case 'ne':
          return value !== operand
        default:
          return value === operand
      }
    }
    return value === condition
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateDashboardId(): string {
    return `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

interface AnalyticsConfig {
  batchSize?: number
  flushInterval?: number
  enabled?: boolean
  debug?: boolean
}

// Create and export singleton instance
export const analytics = new AnalyticsEngine()

// Export types
export type { AnalyticsConfig }