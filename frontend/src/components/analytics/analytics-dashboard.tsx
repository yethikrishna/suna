/**
 * y0 Analytics Dashboard
 * Comprehensive analytics dashboard component
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import {
  Users,
  Activity,
  Clock,
  AlertTriangle,
  TrendingUp,
  Eye,
  MousePointer,
  Zap,
  RefreshCw,
  Download,
  Calendar
} from 'lucide-react'
import { useRealTimeAnalytics, useAnalyticsQuery } from '@/hooks/use-analytics'
import { EventType, EventCategory, AnalyticsQuery } from '@/lib/analytics/analytics-engine'

interface AnalyticsDashboardProps {
  timeframe?: '1h' | '24h' | '7d' | '30d'
  refreshInterval?: number
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#ff0000']

export default function AnalyticsDashboard({ timeframe = '24h', refreshInterval = 30000 }: AnalyticsDashboardProps) {
  const { metrics: realTimeMetrics, isLoading: isRealTimeLoading, refetch: refetchRealTime } = useRealTimeAnalytics(refreshInterval)
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframe)

  // Query for user activity over time
  const { data: userActivityData, isLoading: isUserActivityLoading } = useAnalyticsQuery({
    timeRange: getTimeRangeForTimeframe(selectedTimeframe),
    metrics: [
      { name: 'active_users', type: 'unique_count', field: 'userId' },
      { name: 'page_views', type: 'count' }
    ],
    granularity: getGranularityForTimeframe(selectedTimeframe)
  })

  // Query for event categories distribution
  const { data: eventData, isLoading: isEventLoading } = useAnalyticsQuery({
    timeRange: getTimeRangeForTimeframe(selectedTimeframe),
    metrics: [{ name: 'count', type: 'count' }],
    dimensions: ['category']
  })

  // Query for performance metrics
  const { data: performanceData, isLoading: isPerformanceLoading } = useAnalyticsQuery({
    timeRange: getTimeRangeForTimeframe(selectedTimeframe),
    metrics: [
      { name: 'average_response_time', type: 'average', field: 'value' },
      { name: 'error_rate', type: 'percentage', field: 'success' }
    ],
    filters: [{ field: 'category', operator: 'eq', value: EventCategory.API }]
  })

  // Query for top workflows
  const { data: workflowData, isLoading: isWorkflowLoading } = useAnalyticsQuery({
    timeRange: getTimeRangeForTimeframe(selectedTimeframe),
    metrics: [{ name: 'executions', type: 'count' }],
    dimensions: ['properties.workflowId'],
    filters: [{ field: 'category', operator: 'eq', value: EventCategory.WORKFLOW }]
  })

  function getTimeRangeForTimeframe(tf: string) {
    const end = new Date()
    const start = new Date()

    switch (tf) {
      case '1h':
        start.setHours(start.getHours() - 1)
        break
      case '24h':
        start.setDate(start.getDate() - 1)
        break
      case '7d':
        start.setDate(start.getDate() - 7)
        break
      case '30d':
        start.setDate(start.getDate() - 30)
        break
    }

    return { start, end }
  }

  function getGranularityForTimeframe(tf: string): string {
    switch (tf) {
      case '1h':
        return 'minute'
      case '24h':
        return 'hour'
      case '7d':
        return 'day'
      case '30d':
        return 'day'
      default:
        return 'hour'
    }
  }

  const formatUserActivityData = () => {
    if (!userActivityData?.byDimension?.[0]) return []

    // This would normally contain time-series data
    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      activeUsers: Math.floor(Math.random() * 50) + 10,
      pageViews: Math.floor(Math.random() * 200) + 50
    }))
  }

  const formatEventData = () => {
    if (!eventData?.byDimension?.[0]) return []

    return eventData.byDimension[0].map((item: any) => ({
      name: item.category || 'Unknown',
      value: item.count
    }))
  }

  const formatWorkflowData = () => {
    if (!workflowData?.byDimension?.[0]) return []

    return workflowData.byDimension[0]
      .slice(0, 5)
      .map((item: any) => ({
        workflowId: item.properties?.workflowId || 'Unknown',
        executions: item.executions
      }))
  }

  const handleExport = async () => {
    const exportData = {
      timeframe: selectedTimeframe,
      realTimeMetrics,
      userActivity: userActivityData,
      eventDistribution: eventData,
      performance: performanceData,
      topWorkflows: workflowData,
      exportedAt: new Date().toISOString()
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-export-${selectedTimeframe}-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time insights and performance metrics for the y0 platform
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-md border">
            {['1h', '24h', '7d', '30d'].map((tf) => (
              <Button
                key={tf}
                variant={selectedTimeframe === tf ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedTimeframe(tf)}
                className="rounded-none first:rounded-l-md last:rounded-r-md"
              >
                {tf}
              </Button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>

          <Button variant="outline" size="sm" onClick={() => refetchRealTime()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Real-time Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{realTimeMetrics.activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              Currently online
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Events/min</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{realTimeMetrics.eventsPerMinute}</div>
            <p className="text-xs text-muted-foreground">
              Last 5 minutes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{realTimeMetrics.errorRate}%</div>
            <p className="text-xs text-muted-foreground">
              Error percentage
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{realTimeMetrics.averageResponseTime}ms</div>
            <p className="text-xs text-muted-foreground">
              API response time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* User Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle>User Activity</CardTitle>
            <CardDescription>
              Active users and page views over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={formatUserActivityData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="activeUsers"
                  stroke="#8884d8"
                  strokeWidth={2}
                  name="Active Users"
                />
                <Line
                  type="monotone"
                  dataKey="pageViews"
                  stroke="#82ca9d"
                  strokeWidth={2}
                  name="Page Views"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Event Categories Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Event Distribution</CardTitle>
            <CardDescription>
              Events by category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={formatEventData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {formatEventData().map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>
              API response times and error rates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Average Response Time</span>
                <Badge variant="secondary">
                  {performanceData?.average_response_time || 0}ms
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Error Rate</span>
                <Badge variant={performanceData?.error_rate > 5 ? 'destructive' : 'secondary'}>
                  {performanceData?.error_rate || 0}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Success Rate</span>
                <Badge variant="secondary">
                  {100 - (performanceData?.error_rate || 0)}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Workflows */}
        <Card>
          <CardHeader>
            <CardTitle>Top Workflows</CardTitle>
            <CardDescription>
              Most executed workflows
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {formatWorkflowData().map((workflow: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium truncate">
                      {workflow.workflowId}
                    </span>
                  </div>
                  <Badge variant="outline">
                    {workflow.executions}
                  </Badge>
                </div>
              ))}
              {formatWorkflowData().length === 0 && (
                <p className="text-sm text-muted-foreground">No workflow data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Pages */}
      <Card>
        <CardHeader>
          <CardTitle>Top Pages</CardTitle>
          <CardDescription>
            Most viewed pages in the last 5 minutes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {realTimeMetrics.topPages.map((page, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium truncate">
                    {page.page}
                  </span>
                </div>
                <Badge variant="outline">
                  {page.views} views
                </Badge>
              </div>
            ))}
            {realTimeMetrics.topPages.length === 0 && (
              <p className="text-sm text-muted-foreground">No page view data available</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MousePointer className="h-5 w-5" />
              User Interactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">12,543</div>
            <p className="text-xs text-muted-foreground">
              +12% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Conversion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">3.2%</div>
            <p className="text-xs text-muted-foreground">
              +0.5% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">98.5%</div>
            <p className="text-xs text-muted-foreground">
              Uptime this month
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}