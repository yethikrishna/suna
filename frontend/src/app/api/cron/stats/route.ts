/**
 * y0 Cron Job Statistics API
 * Get cron job statistics and analytics
 */

import { NextRequest, NextResponse } from 'next/server'
import { blink } from '@/lib/blink/client'
import { cronJobManager } from '@/lib/cron/cron-manager'

export async function GET(request: NextRequest) {
  try {
    // Get current user
    const user = await blink.auth.me()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get cron job statistics
    const stats = await cronJobManager.getCronJobStats(user.id)

    // Get recent executions
    const recentExecutions = await blink.db.workflowExecutions?.list({
      where: {
        userId: user.id,
        triggeredBy: 'cron'
      },
      orderBy: { startedAt: 'desc' },
      take: 10
    }) || []

    // Get workflow stats
    const workflows = await blink.db.workflows?.list({
      where: { userId: user.id }
    }) || []

    const workflowsWithCron = []
    for (const workflow of workflows) {
      const cronJobs = await cronJobManager.getWorkflowCronJobs(workflow.id)
      if (cronJobs.length > 0) {
        workflowsWithCron.push({
          id: workflow.id,
          name: workflow.name,
          description: workflow.description,
          cronJobs: cronJobs.length,
          activeCronJobs: cronJobs.filter(job => job.isActive).length,
          totalRuns: cronJobs.reduce((sum, job) => sum + job.runCount, 0)
        })
      }
    }

    // Calculate success rate
    const successfulExecutions = recentExecutions.filter(exec => exec.status === 'completed').length
    const successRate = recentExecutions.length > 0
      ? (successfulExecutions / recentExecutions.length) * 100
      : 0

    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        successRate: Math.round(successRate * 100) / 100,
        workflowsWithCron: workflowsWithCron.length,
        recentExecutions: recentExecutions.length
      },
      recentExecutions: recentExecutions.map(exec => ({
        id: exec.id,
        workflowId: exec.workflowId,
        status: exec.status,
        startedAt: exec.startedAt,
        completedAt: exec.completedAt,
        currentStep: exec.currentStep,
        totalSteps: exec.steps?.length || 0,
        duration: exec.completedAt
          ? new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime()
          : null
      })),
      workflowsWithCron
    })

  } catch (error) {
    console.error('Error fetching cron job statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cron job statistics' },
      { status: 500 }
    )
  }
}