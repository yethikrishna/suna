/**
 * y0 Cron Job Statistics Component
 * Display cron job analytics and statistics
 */

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Calendar, Clock, CheckCircle, TrendingUp, Activity, Target } from 'lucide-react'
import { useCronStats, CronStatsResponse } from '@/hooks/react-query/cron/use-cron-jobs'
import { formatDistanceToNow } from 'date-fns'

interface CronStatsProps {
  className?: string
}

export const CronStats: React.FC<CronStatsProps> = ({ className }) => {
  const { data: statsData, isLoading, error } = useCronStats()

  if (isLoading) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-muted rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error || !statsData?.success) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <div className="text-red-600 mb-2">
            <Activity className="h-8 w-8 mx-auto mb-2" />
          </div>
          <h3 className="text-lg font-medium mb-1">Failed to load statistics</h3>
          <p className="text-muted-foreground text-sm">
            Unable to fetch cron job statistics at this time.
          </p>
        </CardContent>
      </Card>
    )
  }

  const { stats, recentExecutions, workflowsWithCron } = statsData

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600'
    if (rate >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getSuccessRateVariant = (rate: number) => {
    if (rate >= 90) return 'default'
    if (rate >= 70) return 'secondary'
    return 'destructive'
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cron Jobs</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.active} active, {stats.inactive} paused
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRuns.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.recentRuns} in last 24 hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <span className={getSuccessRateColor(stats.successRate)}>
                {stats.successRate}%
              </span>
            </div>
            <Progress value={stats.successRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workflows with Schedules</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.workflowsWithCron}</div>
            <p className="text-xs text-muted-foreground">
              Automated workflows
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cron Job Status</CardTitle>
          <CardDescription>
            Distribution of active and paused cron jobs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-8">
            <div className="flex-1">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Active Jobs</span>
                <span className="text-sm text-muted-foreground">{stats.active} of {stats.total}</span>
              </div>
              <Progress value={(stats.active / stats.total) * 100} className="h-2" />
            </div>
            <div className="flex space-x-4">
              <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-400">
                {stats.active} Active
              </Badge>
              <Badge variant="secondary">
                {stats.inactive} Paused
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Executions */}
      {recentExecutions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Executions</CardTitle>
            <CardDescription>
              Latest cron-triggered workflow executions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentExecutions.slice(0, 5).map((execution) => (
                <div key={execution.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      execution.status === 'completed'
                        ? 'bg-green-500'
                        : execution.status === 'running'
                        ? 'bg-blue-500 animate-pulse'
                        : 'bg-red-500'
                    }`} />
                    <div>
                      <div className="font-medium">Workflow Execution</div>
                      <div className="text-sm text-muted-foreground">
                        Started {formatDistanceToNow(new Date(execution.startedAt), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="font-medium">{execution.currentStep}/{execution.totalSteps}</div>
                      <div className="text-sm text-muted-foreground">steps</div>
                    </div>
                    <Badge variant={execution.status === 'completed' ? 'default' : 'secondary'}>
                      {execution.status}
                    </Badge>
                    {execution.duration && (
                      <div className="text-sm text-muted-foreground">
                        {(execution.duration / 1000).toFixed(1)}s
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workflows with Schedules */}
      {workflowsWithCron.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Automated Workflows</CardTitle>
            <CardDescription>
              Workflows that have scheduled executions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {workflowsWithCron.map((workflow) => (
                <div key={workflow.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{workflow.name}</div>
                    <Badge variant="outline">
                      {workflow.cronJobs} schedules
                    </Badge>
                  </div>
                  {workflow.description && (
                    <div className="text-sm text-muted-foreground mb-2">
                      {workflow.description}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span>{workflow.activeCronJobs} active</span>
                    <span>{workflow.totalRuns} total runs</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">System Health</CardTitle>
          <CardDescription>
            Overall system performance and reliability
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className={`text-2xl font-bold mb-1 ${getSuccessRateColor(stats.successRate)}`}>
                {stats.successRate}%
              </div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold mb-1">
                {stats.recentRuns}
              </div>
              <div className="text-sm text-muted-foreground">Last 24 Hours</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold mb-1">
                {stats.workflowsWithCron}
              </div>
              <div className="text-sm text-muted-foreground">Automated Workflows</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}