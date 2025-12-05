/**
 * y0 Advanced Monitoring Dashboard
 * Real-time system monitoring, alerts, and incident management interface
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { AlertTriangle, CheckCircle, XCircle, Clock, Users, Zap, Shield, Activity, Bell, TrendingUp, TrendingDown, Server, Database, Globe, Cpu, HardDrive, RefreshCw, AlertCircle, CheckCircle2, XCircle2 } from 'lucide-react'
import { alertManager, Alert, AlertRule, Incident, HealthCheck } from '@/lib/monitoring/alert-manager'

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  checks: HealthCheck[]
  activeAlerts: number
  criticalAlerts: number
  uptime: number
  lastUpdate: Date
}

interface MetricsData {
  alerts: {
    total: number
    bySeverity: Record<string, number>
    byCategory: Record<string, number>
    trends: Array<{ date: string; count: number }>
  }
  incidents: {
    open: number
    resolved: number
    mttr: number
    trends: Array<{ date: string; count: number }>
  }
  performance: {
    responseTime: number
    availability: number
    errorRate: number
    throughput: number
  }
}

export function MonitoringDashboard() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [metricsData, setMetricsData] = useState<MetricsData | null>(null)
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([])
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState('overview')

  useEffect(() => {
    loadMonitoringData()
    const interval = setInterval(loadMonitoringData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const loadMonitoringData = async () => {
    try {
      const [health, metrics, alerts] = await Promise.all([
        getSystemHealth(),
        getMetricsData(),
        getActiveAlerts()
      ])

      setSystemHealth(health)
      setMetricsData(metrics)
      setActiveAlerts(alerts)
      setIsLoading(false)
    } catch (error) {
      console.error('Failed to load monitoring data:', error)
      setIsLoading(false)
    }
  }

  // Mock API calls - replace with actual API calls
  const getSystemHealth = async (): Promise<SystemHealth> => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500))
    return {
      overall: 'healthy',
      checks: [
        {
          id: 'database',
          name: 'Database Connection',
          status: 'healthy',
          lastCheck: new Date(),
          responseTime: 45,
          details: { success: true, message: 'Database connection successful' }
        },
        {
          id: 'api',
          name: 'API Health',
          status: 'healthy',
          lastCheck: new Date(),
          responseTime: 120,
          details: { success: true, message: 'API responding normally' }
        },
        {
          id: 'cache',
          name: 'Cache Service',
          status: 'degraded',
          lastCheck: new Date(),
          responseTime: 250,
          details: { success: true, message: 'Cache service responding slowly' }
        }
      ],
      activeAlerts: 3,
      criticalAlerts: 0,
      uptime: 99.9,
      lastUpdate: new Date()
    }
  }

  const getMetricsData = async (): Promise<MetricsData> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    return {
      alerts: {
        total: 12,
        bySeverity: {
          info: 3,
          warning: 7,
          error: 2,
          critical: 0
        },
        byCategory: {
          performance: 5,
          security: 2,
          availability: 3,
          resource: 2,
          business: 0
        },
        trends: Array.from({ length: 7 }, (_, i) => ({
          date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          count: Math.floor(Math.random() * 20) + 5
        })).reverse()
      },
      incidents: {
        open: 1,
        resolved: 8,
        mttr: 45,
        trends: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          count: Math.floor(Math.random() * 3)
        })).reverse()
      },
      performance: {
        responseTime: 185,
        availability: 99.9,
        errorRate: 0.8,
        throughput: 1247
      }
    }
  }

  const getActiveAlerts = async (): Promise<Alert[]> => {
    await new Promise(resolve => setTimeout(resolve, 200))
    return [
      {
        id: 'alert_1',
        ruleId: 'rule_1',
        title: 'High Response Time',
        message: 'API response time is exceeding 2 seconds threshold',
        severity: 'warning',
        status: 'open',
        source: 'api',
        metric: 'response_time',
        value: 2340,
        threshold: 2000,
        triggeredAt: new Date(Date.now() - 15 * 60 * 1000),
        metadata: {},
        escalationLevel: 0
      },
      {
        id: 'alert_2',
        ruleId: 'rule_2',
        title: 'Cache Service Degraded',
        message: 'Cache service showing slower response times',
        severity: 'warning',
        status: 'acknowledged',
        source: 'cache',
        metric: 'cache_response_time',
        value: 450,
        threshold: 300,
        triggeredAt: new Date(Date.now() - 30 * 60 * 1000),
        acknowledgedAt: new Date(Date.now() - 10 * 60 * 1000),
        acknowledgedBy: 'john.doe',
        metadata: {},
        escalationLevel: 0
      },
      {
        id: 'alert_3',
        ruleId: 'rule_3',
        title: 'Error Rate Spike',
        message: 'Error rate increased by 2% in the last hour',
        severity: 'error',
        status: 'open',
        source: 'api',
        metric: 'error_rate',
        value: 2.3,
        threshold: 2,
        triggeredAt: new Date(Date.now() - 45 * 60 * 1000),
        metadata: {},
        escalationLevel: 1
      }
    ]
  }

  const getHealthIcon = (status: HealthCheck['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'degraded':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'unhealthy':
        return <XCircle2 className="h-4 w-4 text-red-500" />
    }
  }

  const getHealthColor = (status: HealthCheck['status']) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50'
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50'
      case 'unhealthy':
        return 'text-red-600 bg-red-50'
    }
  }

  const getSeverityIcon = (severity: Alert['severity']) => {
    switch (severity) {
      case 'info':
        return <Bell className="h-4 w-4 text-blue-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
    }
  }

  const getStatusBadge = (status: Alert['status']) => {
    const variants = {
      open: 'destructive',
      acknowledged: 'secondary',
      resolved: 'default',
      suppressed: 'outline'
    } as const

    return (
      <Badge variant={variants[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / (1000 * 60))
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    return `${minutes}m`
  }

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading monitoring data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Monitoring</h1>
          <p className="text-muted-foreground">Real-time system health, alerts, and performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={systemHealth?.overall === 'healthy' ? 'default' :
                         systemHealth?.overall === 'degraded' ? 'secondary' : 'destructive'}>
            {systemHealth?.overall.charAt(0).toUpperCase() + systemHealth?.overall.slice(1)}
          </Badge>
          <Button variant="outline" size="sm" onClick={loadMonitoringData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getHealthIcon(systemHealth?.overall || 'unhealthy')}
              <div className="text-2xl font-bold capitalize">
                {systemHealth?.overall || 'Unknown'}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Uptime: {systemHealth?.uptime || 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemHealth?.activeAlerts || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {systemHealth?.criticalAlerts || 0} critical
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metricsData?.performance.responseTime || 0}ms
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Average over last hour
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metricsData?.performance.errorRate || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Last 24 hours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Monitoring Dashboard */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="health">Health Checks</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Health Checks */}
            <Card>
              <CardHeader>
                <CardTitle>System Health Checks</CardTitle>
                <CardDescription>
                  Real-time health status of critical services
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {systemHealth?.checks.map((check) => (
                    <div key={check.id} className="flex items-center justify-between p-3 rounded border">
                      <div className="flex items-center gap-3">
                        {getHealthIcon(check.status)}
                        <div>
                          <p className="font-medium">{check.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {check.details.message}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`px-2 py-1 rounded-full text-xs font-medium ${getHealthColor(check.status)}`}>
                          {check.status.toUpperCase()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {check.responseTime}ms
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Alerts */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Alerts</CardTitle>
                <CardDescription>
                  Latest system alerts and notifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeAlerts.slice(0, 5).map((alert) => (
                    <div key={alert.id} className="flex items-start gap-3 p-3 rounded border">
                      {getSeverityIcon(alert.severity)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate">{alert.title}</p>
                          {getStatusBadge(alert.status)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {alert.message}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{formatTime(alert.triggeredAt)}</span>
                          <span>Duration: {formatDuration(Date.now() - alert.triggeredAt.getTime())}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {activeAlerts.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                      <p>No active alerts</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>
                Real-time system performance indicators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Response Time</span>
                    <span className="text-sm text-muted-foreground">
                      {metricsData?.performance.responseTime || 0}ms
                    </span>
                  </div>
                  <Progress
                    value={Math.min((metricsData?.performance.responseTime || 0) / 5, 100)}
                    className="h-2"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Availability</span>
                    <span className="text-sm text-muted-foreground">
                      {metricsData?.performance.availability || 0}%
                    </span>
                  </div>
                  <Progress
                    value={metricsData?.performance.availability || 0}
                    className="h-2"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Error Rate</span>
                    <span className="text-sm text-muted-foreground">
                      {metricsData?.performance.errorRate || 0}%
                    </span>
                  </div>
                  <Progress
                    value={Math.min((metricsData?.performance.errorRate || 0) * 10, 100)}
                    className="h-2"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Throughput</span>
                    <span className="text-sm text-muted-foreground">
                      {metricsData?.performance.throughput || 0}/s
                    </span>
                  </div>
                  <Progress
                    value={Math.min((metricsData?.performance.throughput || 0) / 20, 100)}
                    className="h-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Active Alerts</h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{activeAlerts.length} total</Badge>
              <Button variant="outline" size="sm">
                <Bell className="h-4 w-4 mr-2" />
                Configure Rules
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {activeAlerts.map((alert) => (
              <Card key={alert.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getSeverityIcon(alert.severity)}
                      <div>
                        <h4 className="font-semibold">{alert.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {alert.message}
                        </p>
                        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                          <span>Metric: {alert.metric}</span>
                          <span>Value: {alert.value}</span>
                          <span>Threshold: {alert.threshold}</span>
                          <span>Source: {alert.source}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(alert.status)}
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatTime(alert.triggeredAt)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDuration(Date.now() - alert.triggeredAt.getTime())} ago
                        </p>
                      </div>
                    </div>
                  </div>
                  {alert.status === 'open' && (
                    <div className="flex gap-2 mt-4">
                      <Button variant="outline" size="sm">
                        Acknowledge
                      </Button>
                      <Button variant="outline" size="sm">
                        Create Incident
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {activeAlerts.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
                  <h3 className="text-lg font-semibold">No Active Alerts</h3>
                  <p className="text-muted-foreground">All systems are operating normally</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Health Check Details</CardTitle>
              <CardDescription>
                Comprehensive health monitoring for all system components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {systemHealth?.checks.map((check) => (
                  <div key={check.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getHealthIcon(check.status)}
                        <h4 className="font-semibold">{check.name}</h4>
                      </div>
                      <Badge className={getHealthColor(check.status)}>
                        {check.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Response Time:</span>
                        <span className="font-medium">{check.responseTime}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Check:</span>
                        <span className="font-medium">
                          {check.lastCheck.toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <span className="font-medium">{check.details.message}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incidents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Incident Management</CardTitle>
              <CardDescription>
                Track and manage system incidents and their resolution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold">No Active Incidents</h3>
                <p>All systems are operating without major incidents</p>
                <Button className="mt-4" variant="outline">
                  Create Incident
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Response Time Trends</CardTitle>
                <CardDescription>
                  API response time over the last 24 hours
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Response time chart would be displayed here</p>
                    <p className="text-sm">Average: {metricsData?.performance.responseTime}ms</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alert Trends</CardTitle>
                <CardDescription>
                  Alert volume over the last 7 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Alert trends chart would be displayed here</p>
                    <p className="text-sm">Total this week: {metricsData?.alerts.total} alerts</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Detailed Metrics</CardTitle>
              <CardDescription>
                Comprehensive system performance indicators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="text-center p-4 border rounded-lg">
                  <Globe className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <h3 className="font-semibold">API Gateway</h3>
                  <p className="text-2xl font-bold mt-2">99.9%</p>
                  <p className="text-sm text-muted-foreground">Availability</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Database className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <h3 className="font-semibold">Database</h3>
                  <p className="text-2xl font-bold mt-2">45ms</p>
                  <p className="text-sm text-muted-foreground">Avg Query Time</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Server className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                  <h3 className="font-semibold">Server Load</h3>
                  <p className="text-2xl font-bold mt-2">42%</p>
                  <p className="text-sm text-muted-foreground">CPU Usage</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <HardDrive className="h-8 w-8 mx-auto mb-2 text-orange-500" />
                  <h3 className="font-semibold">Storage</h3>
                  <p className="text-2xl font-bold mt-2">68%</p>
                  <p className="text-sm text-muted-foreground">Disk Usage</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}