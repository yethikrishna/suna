/**
 * y0 Workflows Management Page
 * Main workflows page with navigation to cron job management
 */

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Play, Settings, Calendar, Clock, TrendingUp } from 'lucide-react'
import { useWorkflows, useWorkflowStats } from '@/hooks/react-query/workflows/use-workflows'
import { formatWorkflowStatus, formatExecutionDuration } from '@/hooks/react-query/workflows/use-workflows'

export default function WorkflowsPage() {
  const { data: workflows, isLoading, error } = useWorkflows()
  const { data: stats } = useWorkflowStats()

  const workflowList = workflows || []

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Settings className="h-8 w-8" />
              Workflows
            </h1>
            <p className="text-muted-foreground mt-2">
              Create and manage automated workflows for your tasks
            </p>
          </div>
          <Button asChild>
            <Link href="/workflows/create">
              <Plus className="h-4 w-4 mr-2" />
              Create Workflow
            </Link>
          </Button>
        </div>
      </div>

      {/* Statistics Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Workflows</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.active} active, {stats.inactive} inactive
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
              <Play className="h-4 w-4 text-muted-foreground" />
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
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.successRate}%</div>
              <p className="text-xs text-muted-foreground">
                Average execution time: {stats.averageRunTime}s
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cron Jobs</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <Link href="/workflows/cron" className="hover:underline">
                  Manage
                </Link>
              </div>
              <p className="text-xs text-muted-foreground">
                Schedule automated workflows
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Get started with common workflow tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full justify-start">
              <Link href="/workflows/create">
                <Plus className="h-4 w-4 mr-2" />
                Create New Workflow
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/workflows/cron">
                <Calendar className="h-4 w-4 mr-2" />
                Manage Cron Jobs
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/workflows/templates">
                <Settings className="h-4 w-4 mr-2" />
                Browse Templates
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workflow Templates</CardTitle>
            <CardDescription>
              Start with pre-built workflow templates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 border rounded-lg">
              <h4 className="font-medium">Daily Report Generator</h4>
              <p className="text-sm text-muted-foreground">Generate daily analytics reports</p>
            </div>
            <div className="p-3 border rounded-lg">
              <h4 className="font-medium">Data Backup Automation</h4>
              <p className="text-sm text-muted-foreground">Automated data backup workflows</p>
            </div>
            <div className="p-3 border rounded-lg">
              <h4 className="font-medium">Social Media Scheduler</h4>
              <p className="text-sm text-muted-foreground">Schedule social media posts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Workflows */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Workflows</CardTitle>
              <CardDescription>
                Manage and execute your automated workflows
              </CardDescription>
            </div>
            <Button asChild variant="outline">
              <Link href="/workflows/create">
                <Plus className="h-4 w-4 mr-2" />
                New Workflow
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-4 border rounded-lg animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600">Failed to load workflows</p>
            </div>
          ) : workflowList.length === 0 ? (
            <div className="text-center py-12">
              <Settings className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No workflows yet</h3>
              <p className="text-muted-foreground mb-4">
                Get started by creating your first automated workflow.
              </p>
              <Button asChild>
                <Link href="/workflows/create">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Workflow
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {workflowList.map((workflow) => (
                <div key={workflow.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{workflow.name}</h3>
                      <Badge variant={workflow.isActive ? 'default' : 'secondary'}>
                        {workflow.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {workflow.description && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {workflow.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{workflow.steps.length} steps</span>
                      <span>Run {workflow.runCount} times</span>
                      {workflow.lastRun && (
                        <span>Last run: {new Date(workflow.lastRun).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline">
                      <Play className="h-3 w-3 mr-1" />
                      Run
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/workflows/${workflow.id}/edit`}>
                        <Settings className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cron Jobs Section */}
      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Scheduled Workflows</CardTitle>
              <CardDescription>
                Manage cron jobs for automated workflow execution
              </CardDescription>
            </div>
            <Button asChild>
              <Link href="/workflows/cron">
                <Calendar className="h-4 w-4 mr-2" />
                Manage Cron Jobs
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Automate Your Workflows</h3>
            <p className="text-muted-foreground mb-4">
              Schedule workflows to run automatically using cron jobs.
            </p>
            <Button asChild>
              <Link href="/workflows/cron">
                <Calendar className="h-4 w-4 mr-2" />
                Go to Cron Jobs
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}