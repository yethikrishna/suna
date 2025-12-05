/**
 * y0 Cron Job React Query Hooks
 * React Query hooks for cron job management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreateCronJobRequest } from '@/lib/cron/cron-manager'

// Types
export interface CronJob {
  id: string
  name: string
  description?: string
  schedule: string
  webhookUrl: string
  workflowId: string
  isActive: boolean
  lastRun?: string
  nextRun?: string
  runCount: number
  createdAt: string
  updatedAt: string
  timezone?: string
  headers?: Record<string, string>
  retryCount?: number
  timeout?: number
}

export interface CronJobStats {
  total: number
  active: number
  inactive: number
  totalRuns: number
  recentRuns: number
  successRate: number
  workflowsWithCron: number
  recentExecutions: number
}

export interface CronJobResponse {
  success: boolean
  jobs: CronJob[]
  total: number
  pagination?: {
    page: number
    pageSize: number
    totalPages: number
  }
}

export interface CronJobExecution {
  id: string
  workflowId: string
  status: string
  startedAt: string
  completedAt?: string
  currentStep: number
  totalSteps: number
  duration?: number
}

export interface CronStatsResponse {
  success: boolean
  stats: CronJobStats
  recentExecutions: CronJobExecution[]
  workflowsWithCron: Array<{
    id: string
    name: string
    description?: string
    cronJobs: number
    activeCronJobs: number
    totalRuns: number
  }>
}

// API functions
const fetchCronJobs = async (page: number = 1, pageSize: number = 20): Promise<CronJobResponse> => {
  const response = await fetch(`/api/cron/jobs?page=${page}&pageSize=${pageSize}`)
  if (!response.ok) {
    throw new Error('Failed to fetch cron jobs')
  }
  return response.json()
}

const createCronJob = async (data: CreateCronJobRequest): Promise<CronJobResponse> => {
  const response = await fetch('/api/cron/jobs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  if (!response.ok) {
    throw new Error('Failed to create cron job')
  }
  return response.json()
}

const updateCronJob = async (id: string, data: Partial<CreateCronJobRequest> & { isActive?: boolean }): Promise<{ success: boolean; data: CronJob }> => {
  const response = await fetch(`/api/cron/jobs/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  if (!response.ok) {
    throw new Error('Failed to update cron job')
  }
  return response.json()
}

const deleteCronJob = async (id: string): Promise<{ success: boolean }> => {
  const response = await fetch(`/api/cron/jobs/${id}`, {
    method: 'DELETE'
  })
  if (!response.ok) {
    throw new Error('Failed to delete cron job')
  }
  return response.json()
}

const executeCronJob = async (id: string): Promise<any> => {
  const response = await fetch(`/api/cron/jobs/${id}/execute`, {
    method: 'POST'
  })
  if (!response.ok) {
    throw new Error('Failed to execute cron job')
  }
  return response.json()
}

const fetchCronStats = async (): Promise<CronStatsResponse> => {
  const response = await fetch('/api/cron/stats')
  if (!response.ok) {
    throw new Error('Failed to fetch cron job statistics')
  }
  return response.json()
}

// Hooks
export const useCronJobs = (page: number = 1, pageSize: number = 20) => {
  return useQuery({
    queryKey: ['cron-jobs', page, pageSize],
    queryFn: () => fetchCronJobs(page, pageSize),
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false
  })
}

export const useCreateCronJob = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createCronJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cron-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['cron-stats'] })
    },
    onError: (error) => {
      console.error('Error creating cron job:', error)
    }
  })
}

export const useUpdateCronJob = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateCronJobRequest> & { isActive?: boolean } }) =>
      updateCronJob(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cron-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['cron-stats'] })
    },
    onError: (error) => {
      console.error('Error updating cron job:', error)
    }
  })
}

export const useDeleteCronJob = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteCronJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cron-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['cron-stats'] })
    },
    onError: (error) => {
      console.error('Error deleting cron job:', error)
    }
  })
}

export const useExecuteCronJob = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: executeCronJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cron-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['cron-stats'] })
    },
    onError: (error) => {
      console.error('Error executing cron job:', error)
    }
  })
}

export const useCronStats = () => {
  return useQuery({
    queryKey: ['cron-stats'],
    queryFn: fetchCronStats,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 60 * 5, // Refresh every 5 minutes
    refetchOnWindowFocus: false
  })
}

// Utility functions
export const getNextRunTime = (schedule: string): string => {
  // This is a simplified implementation
  // In production, use a proper cron parser like node-cron
  const now = new Date()
  const nextRun = new Date(now.getTime() + 60 * 60 * 1000) // Next hour for demo
  return nextRun.toISOString()
}

export const getCronDescription = (schedule: string): string => {
  // Simplified cron description
  // In production, use a proper cron parser
  if (schedule === '0 * * * *') return 'Every hour'
  if (schedule === '0 0 * * *') return 'Every day at midnight'
  if (schedule === '0 0 * * 0') return 'Every Sunday at midnight'
  if (schedule === '0 0 1 * *') return 'Every month on the 1st'
  if (schedule === '*/30 * * * *') return 'Every 30 minutes'
  if (schedule === '*/15 * * * *') return 'Every 15 minutes'
  if (schedule === '0 */6 * * *') return 'Every 6 hours'
  if (schedule === '0 9 * * 1-5') return 'Every weekday at 9 AM'
  return schedule
}

export const validateCronExpression = (expression: string): boolean => {
  // Basic cron expression validation
  const cronRegex = /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/
  return cronRegex.test(expression)
}

export const getCommonCronExpressions = () => [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Every day at midnight', value: '0 0 * * *' },
  { label: 'Every day at 9 AM', value: '0 9 * * *' },
  { label: 'Every day at 6 PM', value: '0 18 * * *' },
  { label: 'Every weekday at 9 AM', value: '0 9 * * 1-5' },
  { label: 'Every weekend at 10 AM', value: '0 10 * * 0,6' },
  { label: 'Every Sunday at midnight', value: '0 0 * * 0' },
  { label: 'Every month on the 1st', value: '0 0 1 * *' },
  { label: 'Every Monday at 9 AM', value: '0 9 * * 1' }
]