/**
 * y0 Advanced Monitoring & Alerting System
 * Comprehensive system health monitoring, custom alerts, and proactive issue detection
 */

import { blink } from '@/lib/blink/client'
import { analytics } from '@/lib/analytics/analytics-engine'

export interface AlertSeverity {
  level: 'info' | 'warning' | 'error' | 'critical'
  color: string
  priority: number
  autoEscalate: boolean
}

export interface AlertRule {
  id: string
  name: string
  description: string
  enabled: boolean
  category: 'performance' | 'security' | 'availability' | 'resource' | 'business'
  metric: string
  threshold: number
  comparison: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'percentage'
  severity: AlertSeverity['level']
  condition: {
    duration?: number // seconds
    consecutive?: number
    window?: number // time window in seconds
  }
  notifications: NotificationChannel[]
  cooldown: number // seconds
  createdBy: string
  createdAt: Date
  lastTriggered?: Date
  triggerCount: number
}

export interface NotificationChannel {
  id: string
  name: string
  type: 'email' | 'slack' | 'webhook' | 'sms' | 'teams'
  enabled: boolean
  config: {
    email?: {
      recipients: string[]
      template?: string
    }
    slack?: {
      webhook: string
      channel?: string
    }
    webhook?: {
      url: string
      headers?: Record<string, string>
      template?: string
    }
    sms?: {
      numbers: string[]
      provider: string
    }
    teams?: {
      webhook: string
    }
  }
}

export interface Alert {
  id: string
  ruleId: string
  title: string
  message: string
  severity: AlertSeverity['level']
  status: 'open' | 'acknowledged' | 'resolved' | 'suppressed'
  source: string
  metric: string
  value: number
  threshold: number
  triggeredAt: Date
  acknowledgedAt?: Date
  acknowledgedBy?: string
  resolvedAt?: Date
  resolvedBy?: string
  duration?: number
  impact?: {
    users?: number
    revenue?: number
    performance?: number
  }
  metadata: Record<string, any>
  relatedAlerts?: string[]
  escalationLevel: number
}

export interface SystemMetric {
  name: string
  value: number
  unit: string
  timestamp: Date
  tags: Record<string, string>
  source: string
  aggregation?: 'avg' | 'sum' | 'max' | 'min' | 'count'
}

export interface HealthCheck {
  id: string
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  lastCheck: Date
  responseTime: number
  details: {
    success: boolean
    message?: string
    metrics?: Record<string, number>
  }
  dependencies?: string[]
}

export interface Incident {
  id: string
  title: string
  description: string
  severity: AlertSeverity['level']
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved'
  startedAt: Date
  resolvedAt?: Date
  duration?: number
  affectedServices: string[]
  rootCause?: string
  resolution?: string
  lessonsLearned?: string
  alerts: string[]
  participants: string[]
  communications: IncidentCommunication[]
  impact: {
    users: number
    duration: number
    severity: 'low' | 'medium' | 'high'
  }
}

export interface IncidentCommunication {
  id: string
  timestamp: Date
  type: 'update' | 'announcement' | 'resolution'
  message: string
  author: string
  channels: string[]
}

/**
 * Advanced Alert Manager Class
 */
class AlertManager {
  private alertRules = new Map<string, AlertRule>()
  private activeAlerts = new Map<string, Alert>()
  private incidentHistory: Incident[] = []
  private notificationChannels = new Map<string, NotificationChannel>()
  private healthChecks = new Map<string, HealthCheck>()
  private metricsBuffer: SystemMetric[] = []
  private isInitialized = false

  constructor() {
    this.initializeDefaultRules()
  }

  /**
   * Initialize the alert manager
   */
  async initialize(): Promise<void> {
    try {
      await this.loadAlertRules()
      await this.loadNotificationChannels()
      await this.loadActiveAlerts()
      await this.initializeHealthChecks()

      // Start monitoring
      this.startMetricCollection()
      this.startAlertProcessing()
      this.startHealthChecks()

      this.isInitialized = true
      console.log('[AlertManager] Advanced monitoring system initialized')
    } catch (error) {
      console.error('[AlertManager] Initialization failed:', error)
      throw error
    }
  }

  /**
   * Create a new alert rule
   */
  async createAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'triggerCount'>): Promise<AlertRule> {
    const alertRule: AlertRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      triggerCount: 0
    }

    this.alertRules.set(alertRule.id, alertRule)
    await this.saveAlertRule(alertRule)

    console.log(`[AlertManager] Created alert rule: ${alertRule.name}`)
    return alertRule
  }

  /**
   * Trigger an alert
   */
  async triggerAlert(
    ruleId: string,
    metric: string,
    value: number,
    metadata: Record<string, any> = {}
  ): Promise<Alert | null> {
    const rule = this.alertRules.get(ruleId)
    if (!rule || !rule.enabled) {
      return null
    }

    // Check cooldown period
    if (rule.lastTriggered) {
      const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime()
      if (timeSinceLastTrigger < rule.cooldown * 1000) {
        return null
      }
    }

    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId,
      title: rule.name,
      message: this.generateAlertMessage(rule, metric, value),
      severity: rule.severity,
      status: 'open',
      source: metadata.source || 'system',
      metric,
      value,
      threshold: rule.threshold,
      triggeredAt: new Date(),
      metadata,
      escalationLevel: 0
    }

    this.activeAlerts.set(alert.id, alert)
    rule.lastTriggered = new Date()
    rule.triggerCount++

    // Send notifications
    await this.sendNotifications(alert, rule.notifications)

    // Auto-escalate if configured
    if (this.getSeverityConfig(rule.severity).autoEscalate) {
      setTimeout(() => this.escalateAlert(alert.id), 300000) // 5 minutes
    }

    // Track alert event
    await analytics.track('alert_triggered', {
      alertId: alert.id,
      ruleId: rule.id,
      severity: alert.severity,
      metric,
      value,
      threshold: rule.threshold
    })

    console.log(`[AlertManager] Alert triggered: ${alert.title}`)
    return alert
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId)
    if (!alert || alert.status !== 'open') {
      return false
    }

    alert.status = 'acknowledged'
    alert.acknowledgedAt = new Date()
    alert.acknowledgedBy = userId

    if (alert.triggeredAt) {
      alert.duration = Date.now() - alert.triggeredAt.getTime()
    }

    await this.saveAlert(alert)

    await analytics.track('alert_acknowledged', {
      alertId,
      userId,
      duration: alert.duration
    })

    console.log(`[AlertManager] Alert acknowledged: ${alert.title}`)
    return true
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, userId: string, resolution?: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId)
    if (!alert) {
      return false
    }

    alert.status = 'resolved'
    alert.resolvedAt = new Date()
    alert.resolvedBy = userId

    if (alert.triggeredAt) {
      alert.duration = Date.now() - alert.triggeredAt.getTime()
    }

    await this.saveAlert(alert)
    this.activeAlerts.delete(alertId)

    await analytics.track('alert_resolved', {
      alertId,
      userId,
      duration: alert.duration,
      resolution
    })

    console.log(`[AlertManager] Alert resolved: ${alert.title}`)
    return true
  }

  /**
   * Create an incident from alert(s)
   */
  async createIncident(
    title: string,
    description: string,
    severity: AlertSeverity['level'],
    alertIds: string[],
    createdBy: string
  ): Promise<Incident> {
    const incident: Incident = {
      id: `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      severity,
      status: 'investigating',
      startedAt: new Date(),
      affectedServices: [],
      alerts: alertIds,
      participants: [createdBy],
      communications: [],
      impact: {
        users: 0,
        duration: 0,
        severity: 'medium'
      }
    }

    this.incidentHistory.unshift(incident)
    await this.saveIncident(incident)

    // Mark related alerts as part of incident
    for (const alertId of alertIds) {
      const alert = this.activeAlerts.get(alertId)
      if (alert) {
        alert.relatedAlerts = alertIds.filter(id => id !== alertId)
      }
    }

    await analytics.track('incident_created', {
      incidentId: incident.id,
      severity,
      alertCount: alertIds.length
    })

    console.log(`[AlertManager] Incident created: ${incident.title}`)
    return incident
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy'
    checks: HealthCheck[]
    activeAlerts: number
    criticalAlerts: number
    uptime: number
    lastUpdate: Date
  }> {
    const checks = Array.from(this.healthChecks.values())
    const activeAlerts = this.activeAlerts.size
    const criticalAlerts = Array.from(this.activeAlerts.values())
      .filter(alert => alert.severity === 'critical').length

    // Determine overall health
    const unhealthyChecks = checks.filter(check => check.status === 'unhealthy').length
    const degradedChecks = checks.filter(check => check.status === 'degraded').length

    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    if (unhealthyChecks > 0 || criticalAlerts > 0) {
      overall = 'unhealthy'
    } else if (degradedChecks > 0 || activeAlerts > 5) {
      overall = 'degraded'
    }

    return {
      overall,
      checks,
      activeAlerts,
      criticalAlerts,
      uptime: this.calculateUptime(),
      lastUpdate: new Date()
    }
  }

  /**
   * Get metrics for monitoring dashboard
   */
  getMetricsDashboard(): {
    alerts: {
      total: number
      bySeverity: Record<AlertSeverity['level'], number>
      byCategory: Record<AlertRule['category'], number>
      trends: Array<{ date: string; count: number }>
    }
    incidents: {
      open: number
      resolved: number
      mttr: number // Mean Time to Resolution
      trends: Array<{ date: string; count: number }>
    }
    performance: {
      responseTime: number
      availability: number
      errorRate: number
      throughput: number
    }
  } {
    const alerts = Array.from(this.activeAlerts.values())
    const alertsBySeverity = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0
    }
    const alertsByCategory = {
      performance: 0,
      security: 0,
      availability: 0,
      resource: 0,
      business: 0
    }

    alerts.forEach(alert => {
      alertsBySeverity[alert.severity]++
      const rule = this.alertRules.get(alert.ruleId)
      if (rule) {
        alertsByCategory[rule.category]++
      }
    })

    const openIncidents = this.incidentHistory.filter(inc => inc.status !== 'resolved')
    const resolvedIncidents = this.incidentHistory.filter(inc => inc.status === 'resolved')

    const mttr = resolvedIncidents.length > 0
      ? resolvedIncidents.reduce((sum, inc) => sum + (inc.duration || 0), 0) / resolvedIncidents.length
      : 0

    return {
      alerts: {
        total: alerts.length,
        bySeverity: alertsBySeverity,
        byCategory: alertsByCategory,
        trends: this.getAlertTrends()
      },
      incidents: {
        open: openIncidents.length,
        resolved: resolvedIncidents.length,
        mttr,
        trends: this.getIncidentTrends()
      },
      performance: {
        responseTime: this.getAverageResponseTime(),
        availability: this.getAvailability(),
        errorRate: this.getErrorRate(),
        throughput: this.getThroughput()
      }
    }
  }

  // Private helper methods
  private initializeDefaultRules(): void {
    const defaultRules = [
      {
        name: 'High Error Rate',
        description: 'Alert when error rate exceeds 5%',
        metric: 'error_rate',
        threshold: 5,
        comparison: 'gt' as const,
        severity: 'error' as const,
        category: 'performance' as const,
        enabled: true,
        condition: { duration: 300 }, // 5 minutes
        notifications: [],
        cooldown: 900, // 15 minutes
        createdBy: 'system'
      },
      {
        name: 'High Response Time',
        description: 'Alert when response time exceeds 2 seconds',
        metric: 'response_time',
        threshold: 2000,
        comparison: 'gt' as const,
        severity: 'warning' as const,
        category: 'performance' as const,
        enabled: true,
        condition: { duration: 180 }, // 3 minutes
        notifications: [],
        cooldown: 600, // 10 minutes
        createdBy: 'system'
      },
      {
        name: 'Database Connection Issues',
        description: 'Alert when database connection fails',
        metric: 'database_connection',
        threshold: 1,
        comparison: 'eq' as const,
        severity: 'critical' as const,
        category: 'availability' as const,
        enabled: true,
        condition: { consecutive: 3 },
        notifications: [],
        cooldown: 300, // 5 minutes
        createdBy: 'system'
      },
      {
        name: 'Low Disk Space',
        description: 'Alert when disk usage exceeds 90%',
        metric: 'disk_usage',
        threshold: 90,
        comparison: 'gt' as const,
        severity: 'warning' as const,
        category: 'resource' as const,
        enabled: true,
        notifications: [],
        cooldown: 1800, // 30 minutes
        createdBy: 'system'
      }
    ]

    defaultRules.forEach(rule => {
      this.createAlertRule({
        ...rule,
        notifications: []
      })
    })
  }

  private getSeverityConfig(severity: AlertSeverity['level']): AlertSeverity {
    const configs: Record<AlertSeverity['level'], AlertSeverity> = {
      info: { level: 'info', color: '#3B82F6', priority: 1, autoEscalate: false },
      warning: { level: 'warning', color: '#F59E0B', priority: 2, autoEscalate: false },
      error: { level: 'error', color: '#EF4444', priority: 3, autoEscalate: true },
      critical: { level: 'critical', color: '#DC2626', priority: 4, autoEscalate: true }
    }
    return configs[severity]
  }

  private generateAlertMessage(rule: AlertRule, metric: string, value: number): string {
    const comparison = this.getComparisonText(rule.comparison)
    return `${rule.description}: ${metric} is ${value}${this.getUnit(metric)}, ${comparison} threshold of ${rule.threshold}${this.getUnit(metric)}`
  }

  private getComparisonText(comparison: AlertRule['comparison']): string {
    const texts = {
      gt: 'greater than',
      lt: 'less than',
      eq: 'equal to',
      gte: 'greater than or equal to',
      lte: 'less than or equal to'
    }
    return texts[comparison]
  }

  private getUnit(metric: string): string {
    const units: Record<string, string> = {
      response_time: 'ms',
      error_rate: '%',
      disk_usage: '%',
      memory_usage: '%',
      cpu_usage: '%',
      database_connection: '',
      throughput: 'req/s'
    }
    return units[metric] || ''
  }

  private async sendNotifications(alert: Alert, channels: NotificationChannel[]): Promise<void> {
    for (const channel of channels.filter(ch => ch.enabled)) {
      try {
        await this.sendNotificationToChannel(alert, channel)
      } catch (error) {
        console.error(`Failed to send notification to ${channel.name}:`, error)
      }
    }
  }

  private async sendNotificationToChannel(alert: Alert, channel: NotificationChannel): Promise<void> {
    const payload = {
      title: alert.title,
      message: alert.message,
      severity: alert.severity,
      alertId: alert.id,
      triggeredAt: alert.triggeredAt,
      metric: alert.metric,
      value: alert.value,
      threshold: alert.threshold
    }

    switch (channel.type) {
      case 'email':
        await this.sendEmailNotification(payload, channel.config.email)
        break
      case 'slack':
        await this.sendSlackNotification(payload, channel.config.slack)
        break
      case 'webhook':
        await this.sendWebhookNotification(payload, channel.config.webhook)
        break
      case 'teams':
        await this.sendTeamsNotification(payload, channel.config.teams)
        break
    }
  }

  private async sendEmailNotification(payload: any, config: any): Promise<void> {
    // Implementation for email notifications
    console.log('Email notification:', payload, config)
  }

  private async sendSlackNotification(payload: any, config: any): Promise<void> {
    // Implementation for Slack notifications
    console.log('Slack notification:', payload, config)
  }

  private async sendWebhookNotification(payload: any, config: any): Promise<void> {
    // Implementation for webhook notifications
    console.log('Webhook notification:', payload, config)
  }

  private async sendTeamsNotification(payload: any, config: any): Promise<void> {
    // Implementation for Teams notifications
    console.log('Teams notification:', payload, config)
  }

  private async escalateAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId)
    if (!alert || alert.status !== 'open') {
      return
    }

    alert.escalationLevel++
    // Send escalation notifications
    console.log(`Alert escalated to level ${alert.escalationLevel}: ${alert.title}`)
  }

  private startMetricCollection(): void {
    setInterval(() => {
      this.collectSystemMetrics()
    }, 30000) // Every 30 seconds
  }

  private startAlertProcessing(): void {
    setInterval(() => {
      this.processAlertRules()
    }, 60000) // Every minute
  }

  private startHealthChecks(): void {
    setInterval(() => {
      this.runHealthChecks()
    }, 120000) // Every 2 minutes
  }

  private async collectSystemMetrics(): Promise<void> {
    // Collect system metrics
    const metrics: SystemMetric[] = [
      {
        name: 'response_time',
        value: Math.random() * 1000 + 100,
        unit: 'ms',
        timestamp: new Date(),
        tags: { service: 'api' },
        source: 'system'
      },
      {
        name: 'error_rate',
        value: Math.random() * 5,
        unit: '%',
        timestamp: new Date(),
        tags: { service: 'api' },
        source: 'system'
      },
      {
        name: 'cpu_usage',
        value: Math.random() * 80 + 10,
        unit: '%',
        timestamp: new Date(),
        tags: { service: 'system' },
        source: 'system'
      },
      {
        name: 'memory_usage',
        value: Math.random() * 70 + 20,
        unit: '%',
        timestamp: new Date(),
        tags: { service: 'system' },
        source: 'system'
      }
    ]

    this.metricsBuffer.push(...metrics)
    if (this.metricsBuffer.length > 1000) {
      this.metricsBuffer = this.metricsBuffer.slice(-500)
    }
  }

  private async processAlertRules(): Promise<void> {
    for (const [ruleId, rule] of this.alertRules.entries()) {
      if (!rule.enabled) continue

      const currentMetric = this.getCurrentMetricValue(rule.metric)
      if (currentMetric === null) continue

      if (this.evaluateCondition(currentMetric, rule.threshold, rule.comparison)) {
        await this.triggerAlert(ruleId, rule.metric, currentMetric, {
          source: 'monitoring',
          ruleId,
          timestamp: new Date().toISOString()
        })
      }
    }
  }

  private getCurrentMetricValue(metricName: string): number | null {
    const recentMetrics = this.metricsBuffer
      .filter(m => m.name === metricName)
      .slice(-10)

    if (recentMetrics.length === 0) return null

    // Return average of recent metrics
    return recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length
  }

  private evaluateCondition(value: number, threshold: number, comparison: AlertRule['comparison']): boolean {
    switch (comparison) {
      case 'gt': return value > threshold
      case 'lt': return value < threshold
      case 'eq': return value === threshold
      case 'gte': return value >= threshold
      case 'lte': return value <= threshold
      default: return false
    }
  }

  private async runHealthChecks(): Promise<void> {
    const checks = [
      {
        id: 'database',
        name: 'Database Connection',
        check: async () => {
          const start = Date.now()
          try {
            // Simulate database check
            await new Promise(resolve => setTimeout(resolve, 50))
            return {
              success: true,
              responseTime: Date.now() - start,
              message: 'Database connection successful'
            }
          } catch (error) {
            return {
              success: false,
              responseTime: Date.now() - start,
              message: 'Database connection failed'
            }
          }
        }
      },
      {
        id: 'api',
        name: 'API Health',
        check: async () => {
          const start = Date.now()
          try {
            // Simulate API health check
            await new Promise(resolve => setTimeout(resolve, 100))
            return {
              success: true,
              responseTime: Date.now() - start,
              message: 'API responding normally'
            }
          } catch (error) {
            return {
              success: false,
              responseTime: Date.now() - start,
              message: 'API health check failed'
            }
          }
        }
      },
      {
        id: 'cache',
        name: 'Cache Service',
        check: async () => {
          const start = Date.now()
          try {
            // Simulate cache check
            await new Promise(resolve => setTimeout(resolve, 20))
            return {
              success: true,
              responseTime: Date.now() - start,
              message: 'Cache service operational'
            }
          } catch (error) {
            return {
              success: false,
              responseTime: Date.now() - start,
              message: 'Cache service unavailable'
            }
          }
        }
      }
    ]

    for (const checkConfig of checks) {
      try {
        const result = await checkConfig.check()
        const healthCheck: HealthCheck = {
          id: checkConfig.id,
          name: checkConfig.name,
          status: result.success ? 'healthy' : 'unhealthy',
          lastCheck: new Date(),
          responseTime: result.responseTime,
          details: {
            success: result.success,
            message: result.message,
            metrics: {
              response_time: result.responseTime
            }
          }
        }

        this.healthChecks.set(checkConfig.id, healthCheck)
      } catch (error) {
        console.error(`Health check failed for ${checkConfig.name}:`, error)
      }
    }
  }

  private calculateUptime(): number {
    // Simulate uptime calculation
    return 99.9
  }

  private getAlertTrends(): Array<{ date: string; count: number }> {
    // Generate sample trends data
    const trends = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      trends.push({
        date: date.toISOString().split('T')[0],
        count: Math.floor(Math.random() * 20) + 5
      })
    }
    return trends
  }

  private getIncidentTrends(): Array<{ date: string; count: number }> {
    const trends = []
    for (let i = 30; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      trends.push({
        date: date.toISOString().split('T')[0],
        count: Math.floor(Math.random() * 3)
      })
    }
    return trends
  }

  private getAverageResponseTime(): number {
    const metrics = this.metricsBuffer.filter(m => m.name === 'response_time').slice(-100)
    if (metrics.length === 0) return 0
    return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length
  }

  private getAvailability(): number {
    return 99.9
  }

  private getErrorRate(): number {
    const metrics = this.metricsBuffer.filter(m => m.name === 'error_rate').slice(-100)
    if (metrics.length === 0) return 0
    return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length
  }

  private getThroughput(): number {
    return Math.random() * 1000 + 500
  }

  // Database operations (mocked for now)
  private async loadAlertRules(): Promise<void> {
    // Implementation to load alert rules from database
  }

  private async loadNotificationChannels(): Promise<void> {
    // Implementation to load notification channels from database
  }

  private async loadActiveAlerts(): Promise<void> {
    // Implementation to load active alerts from database
  }

  private async initializeHealthChecks(): Promise<void> {
    // Implementation to initialize health checks from configuration
  }

  private async saveAlertRule(rule: AlertRule): Promise<void> {
    // Implementation to save alert rule to database
  }

  private async saveAlert(alert: Alert): Promise<void> {
    // Implementation to save alert to database
  }

  private async saveIncident(incident: Incident): Promise<void> {
    // Implementation to save incident to database
  }
}

// Export singleton instance
export const alertManager = new AlertManager()

// Export types
export type {
  AlertRule,
  Alert,
  NotificationChannel,
  SystemMetric,
  HealthCheck,
  Incident,
  IncidentCommunication
}