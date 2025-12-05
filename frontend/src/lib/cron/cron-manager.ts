/**
 * y0 Cron Job Manager
 * Manages cron-job.org integration for scheduled workflows
 * Replaces QStash with free cron-job.org service
 */

import { blink } from '@/lib/blink/client'

export interface CronJob {
  id: string
  name: string
  description?: string
  schedule: string // Cron expression
  webhookUrl: string
  workflowId: string
  isActive: boolean
  lastRun?: Date
  nextRun?: Date
  runCount: number
  createdAt: Date
  updatedAt: Date
  timezone?: string
  headers?: Record<string, string>
  retryCount?: number
  timeout?: number
}

export interface CreateCronJobRequest {
  name: string
  description?: string
  schedule: string
  workflowId: string
  timezone?: string
  headers?: Record<string, string>
  retryCount?: number
  timeout?: number
}

export interface CronJobResponse {
  success: boolean
  data?: CronJob
  error?: string
  cronJobId?: string // cron-job.org job ID
}

export interface CronJobListResponse {
  success: boolean
  jobs: CronJob[]
  total: number
  pagination?: {
    page: number
    pageSize: number
    totalPages: number
  }
}

/**
 * Cron Job Manager for cron-job.org integration
 */
export class CronJobManager {
  private static instance: CronJobManager
  private readonly baseUrl = 'https://cron-job.org/api'
  private readonly webhookBaseUrl: string

  constructor() {
    // Get the base URL from environment or use a default
    this.webhookBaseUrl = process.env.NEXT_PUBLIC_URL ||
      process.env.VERCEL_URL ?
      `https://${process.env.VERCEL_URL}` :
      'http://localhost:3000'
  }

  static getInstance(): CronJobManager {
    if (!CronJobManager.instance) {
      CronJobManager.instance = new CronJobManager()
    }
    return CronJobManager.instance
  }

  /**
   * Generate webhook URL for cron job
   */
  private generateWebhookUrl(workflowId: string): string {
    return `${this.webhookBaseUrl}/api/cron/webhook/${workflowId}`
  }

  /**
   * Create a new cron job
   */
  async createCronJob(
    userId: string,
    request: CreateCronJobRequest
  ): Promise<CronJobResponse> {
    try {
      // Validate cron expression
      if (!this.isValidCronExpression(request.schedule)) {
        return {
          success: false,
          error: 'Invalid cron expression. Use format: * * * * * (minute hour day month weekday)'
        }
      }

      // Verify workflow exists
      const workflow = await blink.db.workflows?.findById(request.workflowId)
      if (!workflow || workflow.userId !== userId) {
        return {
          success: false,
          error: 'Workflow not found or access denied'
        }
      }

      // Generate webhook URL
      const webhookUrl = this.generateWebhookUrl(request.workflowId)

      // Store cron job in our database first
      const cronJob = await blink.db.cronJobs?.create({
        userId,
        name: request.name,
        description: request.description,
        schedule: request.schedule,
        webhookUrl,
        workflowId: request.workflowId,
        isActive: true,
        runCount: 0,
        timezone: request.timezone || 'UTC',
        headers: request.headers || {},
        retryCount: request.retryCount || 3,
        timeout: request.timeout || 30000, // 30 seconds default
        createdAt: new Date(),
        updatedAt: new Date()
      })

      if (!cronJob) {
        throw new Error('Failed to create cron job in database')
      }

      // Create job in cron-job.org (if API key is configured)
      let cronJobId: string | undefined
      const cronJobApiKey = process.env.CRON_JOB_API_KEY

      if (cronJobApiKey) {
        try {
          const response = await fetch(`${this.baseUrl}/jobs`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${cronJobApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              job: {
                title: request.name,
                url: webhookUrl,
                datetime: {
                  every: request.schedule,
                  timezone: request.timezone || 'UTC'
                },
                saveResponses: true,
                notify: {
                  onSuccess: false,
                  onFailure: true
                },
                timeout: request.timeout || 30,
                retries: request.retryCount || 3,
                headers: {
                  'Content-Type': 'application/json',
                  'User-Agent': 'y0-cron-webhook/1.0',
                  ...(request.headers || {})
                }
              }
            })
          })

          if (response.ok) {
            const data = await response.json()
            cronJobId = data.job?.id

            // Update our database with cron-job.org ID
            await blink.db.cronJobs?.update(cronJob.id, {
              cronJobId,
              updatedAt: new Date()
            })
          } else {
            console.warn('Failed to create cron-job.org job, but saved locally:', await response.text())
          }
        } catch (error) {
          console.warn('Failed to connect to cron-job.org, but saved locally:', error)
        }
      }

      return {
        success: true,
        data: {
          id: cronJob.id,
          name: cronJob.name,
          description: cronJob.description,
          schedule: cronJob.schedule,
          webhookUrl: cronJob.webhookUrl,
          workflowId: cronJob.workflowId,
          isActive: cronJob.isActive,
          runCount: cronJob.runCount,
          createdAt: new Date(cronJob.createdAt),
          updatedAt: new Date(cronJob.updatedAt),
          timezone: cronJob.timezone,
          headers: cronJob.headers,
          retryCount: cronJob.retryCount,
          timeout: cronJob.timeout
        },
        cronJobId
      }

    } catch (error) {
      console.error('Error creating cron job:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create cron job'
      }
    }
  }

  /**
   * List all cron jobs for a user
   */
  async listCronJobs(
    userId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<CronJobListResponse> {
    try {
      const skip = (page - 1) * pageSize

      const jobs = await blink.db.cronJobs?.list({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      }) || []

      const total = await blink.db.cronJobs?.count({ where: { userId } }) || 0

      return {
        success: true,
        jobs: jobs.map(job => ({
          id: job.id,
          name: job.name,
          description: job.description,
          schedule: job.schedule,
          webhookUrl: job.webhookUrl,
          workflowId: job.workflowId,
          isActive: job.isActive,
          lastRun: job.lastRun ? new Date(job.lastRun) : undefined,
          nextRun: job.nextRun ? new Date(job.nextRun) : undefined,
          runCount: job.runCount,
          createdAt: new Date(job.createdAt),
          updatedAt: new Date(job.updatedAt),
          timezone: job.timezone,
          headers: job.headers,
          retryCount: job.retryCount,
          timeout: job.timeout
        })),
        total,
        pagination: {
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize)
        }
      }

    } catch (error) {
      console.error('Error listing cron jobs:', error)
      return {
        success: false,
        jobs: [],
        total: 0
      }
    }
  }

  /**
   * Update a cron job
   */
  async updateCronJob(
    userId: string,
    cronJobId: string,
    updates: Partial<CreateCronJobRequest> & { isActive?: boolean }
  ): Promise<CronJobResponse> {
    try {
      // Verify job exists and belongs to user
      const existingJob = await blink.db.cronJobs?.findById(cronJobId)
      if (!existingJob || existingJob.userId !== userId) {
        return {
          success: false,
          error: 'Cron job not found or access denied'
        }
      }

      // Validate cron expression if provided
      if (updates.schedule && !this.isValidCronExpression(updates.schedule)) {
        return {
          success: false,
          error: 'Invalid cron expression'
        }
      }

      // Prepare update data
      const updateData: any = {
        ...updates,
        updatedAt: new Date()
      }

      // Update webhook URL if workflow changed
      if (updates.workflowId && updates.workflowId !== existingJob.workflowId) {
        updateData.webhookUrl = this.generateWebhookUrl(updates.workflowId)
      }

      // Update in our database
      const updatedJob = await blink.db.cronJobs?.update(cronJobId, updateData)
      if (!updatedJob) {
        throw new Error('Failed to update cron job')
      }

      // Update in cron-job.org if API key and external ID exist
      if (existingJob.cronJobId && updates) {
        const cronJobApiKey = process.env.CRON_JOB_API_KEY
        if (cronJobApiKey) {
          try {
            await fetch(`${this.baseUrl}/jobs/${existingJob.cronJobId}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${cronJobApiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                job: {
                  title: updates.name || existingJob.name,
                  url: updateData.webhookUrl || existingJob.webhookUrl,
                  datetime: {
                    every: updates.schedule || existingJob.schedule,
                    timezone: updates.timezone || existingJob.timezone
                  },
                  enabled: updates.isActive !== undefined ? updates.isActive : existingJob.isActive,
                  timeout: updates.timeout || existingJob.timeout,
                  retries: updates.retryCount || existingJob.retryCount,
                  headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'y0-cron-webhook/1.0',
                    ...(updates.headers || existingJob.headers)
                  }
                }
              })
            })
          } catch (error) {
            console.warn('Failed to update cron-job.org job:', error)
          }
        }
      }

      return {
        success: true,
        data: {
          id: updatedJob.id,
          name: updatedJob.name,
          description: updatedJob.description,
          schedule: updatedJob.schedule,
          webhookUrl: updatedJob.webhookUrl,
          workflowId: updatedJob.workflowId,
          isActive: updatedJob.isActive,
          lastRun: updatedJob.lastRun ? new Date(updatedJob.lastRun) : undefined,
          nextRun: updatedJob.nextRun ? new Date(updatedJob.nextRun) : undefined,
          runCount: updatedJob.runCount,
          createdAt: new Date(updatedJob.createdAt),
          updatedAt: new Date(updatedJob.updatedAt),
          timezone: updatedJob.timezone,
          headers: updatedJob.headers,
          retryCount: updatedJob.retryCount,
          timeout: updatedJob.timeout
        }
      }

    } catch (error) {
      console.error('Error updating cron job:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update cron job'
      }
    }
  }

  /**
   * Delete a cron job
   */
  async deleteCronJob(userId: string, cronJobId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify job exists and belongs to user
      const existingJob = await blink.db.cronJobs?.findById(cronJobId)
      if (!existingJob || existingJob.userId !== userId) {
        return {
          success: false,
          error: 'Cron job not found or access denied'
        }
      }

      // Delete from cron-job.org if external ID exists
      if (existingJob.cronJobId) {
        const cronJobApiKey = process.env.CRON_JOB_API_KEY
        if (cronJobApiKey) {
          try {
            await fetch(`${this.baseUrl}/jobs/${existingJob.cronJobId}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${cronJobApiKey}`
              }
            })
          } catch (error) {
            console.warn('Failed to delete cron-job.org job:', error)
          }
        }
      }

      // Delete from our database
      await blink.db.cronJobs?.delete(cronJobId)

      return { success: true }

    } catch (error) {
      console.error('Error deleting cron job:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete cron job'
      }
    }
  }

  /**
   * Validate cron expression
   */
  private isValidCronExpression(expression: string): boolean {
    // Basic cron expression validation: * * * * * (minute hour day month weekday)
    const cronRegex = /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/
    return cronRegex.test(expression)
  }

  /**
   * Get next run time for a cron job
   */
  getNextRunTime(schedule: string, timezone: string = 'UTC'): Date | null {
    try {
      // This is a simplified implementation
      // In production, you'd use a proper cron parser like node-cron
      const now = new Date()

      // For demo purposes, return next hour
      const nextRun = new Date(now.getTime() + 60 * 60 * 1000)
      return nextRun
    } catch (error) {
      console.error('Error calculating next run time:', error)
      return null
    }
  }

  /**
   * Get scheduled runs for a workflow
   */
  async getWorkflowCronJobs(workflowId: string): Promise<CronJob[]> {
    try {
      const jobs = await blink.db.cronJobs?.list({
        where: { workflowId, isActive: true },
        orderBy: { createdAt: 'desc' }
      }) || []

      return jobs.map(job => ({
        id: job.id,
        name: job.name,
        description: job.description,
        schedule: job.schedule,
        webhookUrl: job.webhookUrl,
        workflowId: job.workflowId,
        isActive: job.isActive,
        lastRun: job.lastRun ? new Date(job.lastRun) : undefined,
        nextRun: job.nextRun ? new Date(job.nextRun) : undefined,
        runCount: job.runCount,
        createdAt: new Date(job.createdAt),
        updatedAt: new Date(job.updatedAt),
        timezone: job.timezone,
        headers: job.headers,
        retryCount: job.retryCount,
        timeout: job.timeout
      }))
    } catch (error) {
      console.error('Error getting workflow cron jobs:', error)
      return []
    }
  }

  /**
   * Get cron job statistics
   */
  async getCronJobStats(userId: string): Promise<{
    total: number
    active: number
    inactive: number
    totalRuns: number
    recentRuns: number
  }> {
    try {
      const jobs = await blink.db.cronJobs?.list({
        where: { userId }
      }) || []

      const active = jobs.filter(job => job.isActive).length
      const totalRuns = jobs.reduce((sum, job) => sum + job.runCount, 0)

      // Count runs in the last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const recentRuns = jobs.filter(job =>
        job.lastRun && new Date(job.lastRun) > oneDayAgo
      ).length

      return {
        total: jobs.length,
        active,
        inactive: jobs.length - active,
        totalRuns,
        recentRuns
      }
    } catch (error) {
      console.error('Error getting cron job stats:', error)
      return {
        total: 0,
        active: 0,
        inactive: 0,
        totalRuns: 0,
        recentRuns: 0
      }
    }
  }
}

// Export singleton instance
export const cronJobManager = CronJobManager.getInstance()