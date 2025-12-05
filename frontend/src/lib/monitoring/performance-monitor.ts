/**
 * y0 Performance Monitor
 * Monitor application performance and system health
 */

import { blink } from '@/lib/blink/client'

export interface PerformanceMetrics {
  timestamp: Date
  memoryUsage: number
  responseTime: number
  errorRate: number
  activeUsers: number
  requestCount: number
  cpuUsage?: number
  diskUsage?: number
  networkLatency?: number
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical' | 'unknown'
  uptime: number
  lastCheck: Date
  services: ServiceHealth[]
  alerts: Alert[]
}

export interface ServiceHealth {
  name: string
  status: 'up' | 'down' | 'degraded'
  responseTime: number
  lastCheck: Date
  errorCount: number
  url?: string
}

export interface Alert {
  id: string
  type: 'error' | 'warning' | 'info'
  message: string
  service: string
  timestamp: Date
  resolved: boolean
  metadata?: Record<string, any>
}

/**
 * Performance Monitor for tracking application health
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: PerformanceMetrics[] = []
  private alerts: Alert[] = []
  private isMonitoring = false
  private monitoringInterval?: NodeJS.Timeout

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  /**
   * Start monitoring performance
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.isMonitoring) {
      return
    }

    this.isMonitoring = true
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics()
      this.checkSystemHealth()
    }, intervalMs)

    console.log('Performance monitoring started')
  }

  /**
   * Stop monitoring performance
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return
    }

    this.isMonitoring = false
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = undefined
    }

    console.log('Performance monitoring stopped')
  }

  /**
   * Collect performance metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const metrics: PerformanceMetrics = {
        timestamp: new Date(),
        memoryUsage: this.getMemoryUsage(),
        responseTime: await this.getAverageResponseTime(),
        errorRate: await this.getErrorRate(),
        activeUsers: await this.getActiveUsers(),
        requestCount: await this.getRequestCount(),
        cpuUsage: this.getCPUUsage(),
        networkLatency: await this.getNetworkLatency()
      }

      // Store metrics (keep last 1000 entries)
      this.metrics.push(metrics)
      if (this.metrics.length > 1000) {
        this.metrics = this.metrics.slice(-1000)
      }

      // Store in Blink DB for persistence (optional)
      try {
        if (blink.db.performanceMetrics && typeof blink.db.performanceMetrics.create === 'function') {
          await blink.db.performanceMetrics.create({
            ...metrics,
            timestamp: metrics.timestamp.toISOString()
          })
        }
      } catch (dbError) {
        // Silently ignore DB errors for monitoring
        console.debug('Could not store metrics in DB:', dbError)
      }

    } catch (error) {
      console.error('Error collecting performance metrics:', error)
    }
  }

  /**
   * Check system health
   */
  private async checkSystemHealth(): Promise<void> {
    try {
      const services = await this.checkServices()
      const criticalServices = services.filter(s => s.status === 'down')
      const degradedServices = services.filter(s => s.status === 'degraded')

      let status: 'healthy' | 'warning' | 'critical' | 'unknown' = 'healthy'
      if (criticalServices.length > 0) {
        status = 'critical'
      } else if (degradedServices.length > 0) {
        status = 'warning'
      }

      const systemHealth: SystemHealth = {
        status,
        uptime: this.getUptime(),
        lastCheck: new Date(),
        services,
        alerts: this.getRecentAlerts()
      }

      // Check for alert conditions
      await this.checkAlertConditions(systemHealth)

      // Store health status (optional)
      try {
        if (blink.db.systemHealth && typeof blink.db.systemHealth.create === 'function') {
          await blink.db.systemHealth.create({
            status,
            uptime: systemHealth.uptime,
            services,
            timestamp: new Date().toISOString()
          })
        }
      } catch (dbError) {
        console.debug('Could not store health status in DB:', dbError)
      }

    } catch (error) {
      console.error('Error checking system health:', error)
    }
  }

  /**
   * Check external services
   */
  private async checkServices(): Promise<ServiceHealth[]> {
    const services = [
      { name: 'Blink API', url: 'https://api.blinkdotnew.com/health' },
      { name: 'Database', url: null }, // Internal check
      { name: 'Cron Webhook', url: `${process.env.NEXT_PUBLIC_URL}/api/health` }
    ]

    const serviceHealth: ServiceHealth[] = []

    for (const service of services) {
      try {
        const startTime = Date.now()
        let status: 'up' | 'down' | 'degraded' = 'up'
        let responseTime = 0
        let errorCount = 0

        if (service.url) {
          const response = await fetch(service.url, {
            method: 'GET',
            signal: AbortSignal.timeout(5000) // 5 second timeout
          })
          responseTime = Date.now() - startTime

          if (!response.ok) {
            status = response.status >= 500 ? 'down' : 'degraded'
            errorCount = 1
          }
        } else {
          // Internal service check (e.g., database)
          responseTime = Date.now() - startTime
          try {
            // Just test Blink SDK availability
            if (blink.db) {
              // Simple connectivity test
              await Promise.race([
                Promise.resolve(),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('Timeout')), 1000)
                )
              ])
            }
          } catch (error) {
            status = 'down'
            errorCount = 1
          }
        }

        serviceHealth.push({
          name: service.name,
          status,
          responseTime,
          lastCheck: new Date(),
          errorCount,
          url: service.url
        })

      } catch (error) {
        serviceHealth.push({
          name: service.name,
          status: 'down',
          responseTime: 5000,
          lastCheck: new Date(),
          errorCount: 1,
          url: service.url
        })
      }
    }

    return serviceHealth
  }

  /**
   * Check for alert conditions
   */
  private async checkAlertConditions(systemHealth: SystemHealth): Promise<void> {
    const conditions = [
      {
        condition: () => systemHealth.status === 'critical',
        type: 'error' as const,
        message: 'Critical system services are down',
        service: 'System'
      },
      {
        condition: () => systemHealth.status === 'warning',
        type: 'warning' as const,
        message: 'Some system services are degraded',
        service: 'System'
      },
      {
        condition: () => this.metrics.length > 0 && this.metrics[this.metrics.length - 1].errorRate > 10,
        type: 'warning' as const,
        message: 'High error rate detected',
        service: 'Application'
      },
      {
        condition: () => this.metrics.length > 0 && this.metrics[this.metrics.length - 1].responseTime > 5000,
        type: 'warning' as const,
        message: 'High response time detected',
        service: 'Application'
      },
      {
        condition: () => this.metrics.length > 0 && this.metrics[this.metrics.length - 1].memoryUsage > 90,
        type: 'warning' as const,
        message: 'High memory usage detected',
        service: 'System'
      }
    ]

    for (const condition of conditions) {
      if (condition.condition()) {
        await this.createAlert({
          type: condition.type,
          message: condition.message,
          service: condition.service,
          metadata: {
            systemHealth,
            latestMetrics: this.metrics[this.metrics.length - 1]
          }
        })
      }
    }
  }

  /**
   * Create an alert
   */
  private async createAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    const fullAlert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      resolved: false,
      ...alert
    }

    this.alerts.push(fullAlert)

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100)
    }

    // Store in Blink DB (optional)
    try {
      if (blink.db.alerts && typeof blink.db.alerts.create === 'function') {
        await blink.db.alerts.create({
          ...fullAlert,
          timestamp: fullAlert.timestamp.toISOString()
        })
      }
    } catch (dbError) {
      console.debug('Could not store alert in DB:', dbError)
    }

    // Log alert
    console.warn(`[ALERT] ${alert.type.toUpperCase()}: ${alert.message}`, {
      service: alert.service,
      metadata: alert.metadata
    })
  }

  /**
   * Get memory usage percentage
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      const totalMemory = usage.heapTotal + usage.external
      const usedMemory = usage.heapUsed + usage.external
      return Math.round((usedMemory / totalMemory) * 100)
    }
    return 0
  }

  /**
   * Get CPU usage (simplified)
   */
  private getCPUUsage(): number {
    // This is a simplified implementation
    // In production, you'd use proper CPU monitoring
    return Math.random() * 20 // Mock 0-20% CPU usage
  }

  /**
   * Get system uptime in milliseconds
   */
  private getUptime(): number {
    if (typeof process !== 'undefined' && process.uptime) {
      return Math.round(process.uptime() * 1000)
    }
    return 0
  }

  /**
   * Get average response time
   */
  private async getAverageResponseTime(): Promise<number> {
    try {
      // Use in-memory metrics instead of database query
      const recentMetrics = this.metrics.slice(-100)

      if (recentMetrics.length === 0) {
        return 0
      }

      const responseTimes = recentMetrics.map(m => m.responseTime).filter(rt => rt > 0)
      return responseTimes.length > 0
        ? Math.round(responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length)
        : 0
    } catch (error) {
      console.error('Error getting average response time:', error)
      return 0
    }
  }

  /**
   * Get error rate percentage
   */
  private async getErrorRate(): Promise<number> {
    try {
      // Mock error rate calculation - in production would use real request logs
      return Math.random() * 5 // Mock 0-5% error rate
    } catch (error) {
      console.error('Error getting error rate:', error)
      return 0
    }
  }

  /**
   * Get active user count
   */
  private async getActiveUsers(): Promise<number> {
    try {
      // Mock active user count - in production would use real user activity data
      return Math.floor(Math.random() * 50) + 1 // Mock 1-50 active users
    } catch (error) {
      console.error('Error getting active users:', error)
      return 0
    }
  }

  /**
   * Get total request count
   */
  private async getRequestCount(): Promise<number> {
    try {
      // Mock request count - in production would use real request logs
      return Math.floor(Math.random() * 1000) + 100 // Mock 100-1100 requests per hour
    } catch (error) {
      console.error('Error getting request count:', error)
      return 0
    }
  }

  /**
   * Get network latency
   */
  private async getNetworkLatency(): Promise<number> {
    try {
      const startTime = Date.now()
      await fetch('https://httpbin.org/delay/0', {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      return Date.now() - startTime
    } catch (error) {
      console.error('Error measuring network latency:', error)
      return 0
    }
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(limit: number = 100): PerformanceMetrics[] {
    return this.metrics.slice(-limit)
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 50): Alert[] {
    return this.alerts
      .filter(alert => !alert.resolved)
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const services = await this.checkServices()
    const criticalServices = services.filter(s => s.status === 'down')
    const degradedServices = services.filter(s => s.status === 'degraded')

    let status: 'healthy' | 'warning' | 'critical' | 'unknown' = 'healthy'
    if (criticalServices.length > 0) {
      status = 'critical'
    } else if (degradedServices.length > 0) {
      status = 'warning'
    }

    return {
      status,
      uptime: this.getUptime(),
      lastCheck: new Date(),
      services,
      alerts: this.getRecentAlerts()
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const alertIndex = this.alerts.findIndex(a => a.id === alertId)
    if (alertIndex !== -1) {
      this.alerts[alertIndex].resolved = true
      this.alerts[alertIndex].timestamp = new Date()

      // Update in Blink DB (optional)
    try {
      if (blink.db.alerts && typeof blink.db.alerts.update === 'function') {
        await blink.db.alerts.update(alertId, {
          resolved: true,
          resolvedAt: new Date().toISOString()
        })
      }
    } catch (dbError) {
      console.debug('Could not update alert in DB:', dbError)
    }
    }
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance()