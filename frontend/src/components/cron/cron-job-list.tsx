/**
 * y0 Cron Job List Component
 * List and manage cron jobs
 */

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { MoreHorizontal, Play, Edit, Trash2, Clock, Calendar, CheckCircle, XCircle } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { CronJob, useUpdateCronJob, useDeleteCronJob, useExecuteCronJob } from '@/hooks/react-query/cron/use-cron-jobs'
import { getCronDescription } from '@/hooks/react-query/cron/use-cron-jobs'
import { toast } from 'sonner'

interface CronJobListProps {
  cronJobs: CronJob[]
  onEdit: (cronJob: CronJob) => void
}

export const CronJobList: React.FC<CronJobListProps> = ({ cronJobs, onEdit }) => {
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; cronJob?: CronJob }>({ open: false })

  const updateCronJob = useUpdateCronJob()
  const deleteCronJobMutation = useDeleteCronJob()
  const executeCronJob = useExecuteCronJob()

  const handleToggleActive = async (cronJob: CronJob) => {
    try {
      await updateCronJob.mutateAsync({
        id: cronJob.id,
        data: { isActive: !cronJob.isActive }
      })
      toast.success(`Cron job ${cronJob.isActive ? 'paused' : 'resumed'}`)
    } catch (error) {
      toast.error('Failed to update cron job')
    }
  }

  const handleExecute = async (cronJob: CronJob) => {
    try {
      await executeCronJob.mutateAsync(cronJob.id)
      toast.success('Cron job executed successfully')
    } catch (error) {
      toast.error('Failed to execute cron job')
    }
  }

  const handleDelete = async () => {
    if (!deleteDialog.cronJob) return

    try {
      await deleteCronJobMutation.mutateAsync(deleteDialog.cronJob.id)
      toast.success('Cron job deleted successfully')
      setDeleteDialog({ open: false })
    } catch (error) {
      toast.error('Failed to delete cron job')
    }
  }

  const getStatusBadge = (cronJob: CronJob) => {
    if (cronJob.isActive) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-400">Active</Badge>
    } else {
      return <Badge variant="secondary">Paused</Badge>
    }
  }

  const formatLastRun = (lastRun?: string) => {
    if (!lastRun) return 'Never'
    const date = new Date(lastRun)
    return date.toLocaleString()
  }

  const formatNextRun = (nextRun?: string) => {
    if (!nextRun) return 'Not scheduled'
    const date = new Date(nextRun)
    return date.toLocaleString()
  }

  if (cronJobs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No cron jobs scheduled</h3>
          <p className="text-muted-foreground">
            Create your first cron job to start automating your workflows.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {cronJobs.map((cronJob) => (
          <Card key={cronJob.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{cronJob.name}</CardTitle>
                  {cronJob.description && (
                    <CardDescription className="mt-1">
                      {cronJob.description}
                    </CardDescription>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(cronJob)}
                  <Switch
                    checked={cronJob.isActive}
                    onCheckedChange={() => handleToggleActive(cronJob)}
                    disabled={updateCronJob.isPending}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleExecute(cronJob)}>
                        <Play className="h-4 w-4 mr-2" />
                        Run Now
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(cronJob)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteDialog({ open: true, cronJob })}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Schedule</div>
                    <div className="text-xs text-muted-foreground">
                      {getCronDescription(cronJob.schedule)}
                    </div>
                    <div className="text-xs font-mono text-muted-foreground">
                      {cronJob.schedule}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Last Run</div>
                    <div className="text-xs text-muted-foreground">
                      {formatLastRun(cronJob.lastRun)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Run Count</div>
                    <div className="text-xs text-muted-foreground">
                      {cronJob.runCount} executions
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="text-sm">
                    <div className="font-medium">Timezone</div>
                    <div className="text-xs text-muted-foreground">
                      {cronJob.timezone || 'UTC'}
                    </div>
                  </div>
                </div>
              </div>

              {cronJob.nextRun && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center space-x-2">
                    <div className="text-sm text-muted-foreground">
                      <strong>Next Run:</strong> {formatNextRun(cronJob.nextRun)}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, cronJob: undefined })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cron Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDialog.cronJob?.name}"? This action cannot be undone.
              The scheduled execution will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteCronJobMutation.isPending}
            >
              {deleteCronJobMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}