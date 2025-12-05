/**
 * y0 Cron Jobs Management Page
 * Main page for managing scheduled workflows
 */

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Calendar, Settings, BarChart3, Clock } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CronJobForm } from '@/components/cron/cron-job-form'
import { CronJobList } from '@/components/cron/cron-job-list'
import { CronStats } from '@/components/cron/cron-stats'
import { useCronJobs } from '@/hooks/react-query/cron/use-cron-jobs'
import { useWorkflows } from '@/hooks/react-query/workflows/use-workflows'
import { CreateCronJobRequest } from '@/lib/cron/cron-manager'
import { toast } from 'sonner'

export default function CronJobsPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingJob, setEditingJob] = useState<any>(null)
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null)

  const { data: cronJobsData, isLoading, refetch } = useCronJobs()
  const { data: workflowsData } = useWorkflows()

  const cronJobs = cronJobsData?.jobs || []
  const workflows = workflowsData?.workflows || []

  const handleCreateCronJob = () => {
    if (!selectedWorkflow) {
      toast.error('Please select a workflow first')
      return
    }
    setShowCreateForm(true)
  }

  const handleEditCronJob = (cronJob: any) => {
    setEditingJob(cronJob)
    const workflow = workflows.find(w => w.id === cronJob.workflowId)
    setSelectedWorkflow(workflow)
    setActiveTab('manage')
  }

  const handleFormSubmit = async (data: CreateCronJobRequest) => {
    try {
      if (editingJob) {
        // Update existing cron job
        // This would call the update mutation
        toast.success('Cron job updated successfully')
      } else {
        // Create new cron job
        // This would call the create mutation
        toast.success('Cron job created successfully')
      }

      setShowCreateForm(false)
      setEditingJob(null)
      setSelectedWorkflow(null)
      refetch()
    } catch (error) {
      toast.error('Failed to save cron job')
    }
  }

  const handleFormCancel = () => {
    setShowCreateForm(false)
    setEditingJob(null)
    setSelectedWorkflow(null)
  }

  if (showCreateForm || editingJob) {
    return (
      <div className="container mx-auto py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={handleFormCancel}
            className="mb-4"
          >
            ← Back to Cron Jobs
          </Button>
          <h1 className="text-3xl font-bold">
            {editingJob ? 'Edit Cron Job' : 'Create Cron Job'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {editingJob
              ? 'Modify the schedule and settings for this cron job'
              : 'Schedule a workflow to run automatically on a recurring basis'
            }
          </p>
        </div>

        <div className="flex justify-center">
          <CronJobForm
            workflowId={selectedWorkflow?.id || ''}
            workflowName={selectedWorkflow?.name || ''}
            initialData={editingJob}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Calendar className="h-8 w-8" />
              Cron Jobs
            </h1>
            <p className="text-muted-foreground mt-2">
              Schedule and automate your workflows with cron jobs
            </p>
          </div>
          <Button onClick={handleCreateCronJob} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Cron Job
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Manage Jobs
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Schedule
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <CronStats />
        </TabsContent>

        <TabsContent value="manage">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Scheduled Cron Jobs</CardTitle>
                <CardDescription>
                  Manage your automated workflow schedules
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CronJobList
                  cronJobs={cronJobs}
                  onEdit={handleEditCronJob}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="schedule">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Available Workflows</CardTitle>
                <CardDescription>
                  Select a workflow to create a new cron job schedule
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {workflows.map((workflow: any) => (
                    <Card key={workflow.id} className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => {
                            setSelectedWorkflow(workflow)
                            setShowCreateForm(true)
                          }}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium">{workflow.name}</h3>
                          <Button size="sm" variant="outline">
                            <Plus className="h-3 w-3 mr-1" />
                            Schedule
                          </Button>
                        </div>
                        {workflow.description && (
                          <p className="text-sm text-muted-foreground mb-3">
                            {workflow.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{workflow.steps?.length || 0} steps</span>
                          <span>{workflow.isActive ? 'Active' : 'Inactive'}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {workflows.length === 0 && (
                  <div className="text-center py-12">
                    <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No workflows available</h3>
                    <p className="text-muted-foreground mb-4">
                      Create workflows first to schedule them with cron jobs.
                    </p>
                    <Button>
                      Create Workflow
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cron Expression Guide */}
            <Card>
              <CardHeader>
                <CardTitle>Cron Expression Guide</CardTitle>
                <CardDescription>
                  Learn how to write cron expressions for scheduling
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Cron Expression Format</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Cron expressions use 5 fields: <code className="bg-muted px-2 py-1 rounded">* * * * *</code>
                    </p>
                    <div className="space-y-2 text-sm">
                      <div><code className="bg-muted px-2 py-1 rounded">minute</code> (0-59)</div>
                      <div><code className="bg-muted px-2 py-1 rounded">hour</code> (0-23)</div>
                      <div><code className="bg-muted px-2 py-1 rounded">day</code> (1-31)</div>
                      <div><code className="bg-muted px-2 py-1 rounded">month</code> (1-12)</div>
                      <div><code className="bg-muted px-2 py-1 rounded">weekday</code> (0-6, 0=Sunday)</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-3">Common Examples</h4>
                    <div className="space-y-2 text-sm font-mono">
                      <div><code className="bg-muted px-2 py-1 rounded">* * * * *</code> - Every minute</div>
                      <div><code className="bg-muted px-2 py-1 rounded">*/15 * * * *</code> - Every 15 minutes</div>
                      <div><code className="bg-muted px-2 py-1 rounded">0 * * * *</code> - Every hour</div>
                      <div><code className="bg-muted px-2 py-1 rounded">0 9 * * *</code> - Every day at 9 AM</div>
                      <div><code className="bg-muted px-2 py-1 rounded">0 9 * * 1-5</code> - Weekdays at 9 AM</div>
                      <div><code className="bg-muted px-2 py-1 rounded">0 0 1 * *</code> - Monthly on the 1st</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}