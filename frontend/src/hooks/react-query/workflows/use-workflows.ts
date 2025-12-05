/**
 * y0 Workflows React Query Hooks
 * React Query hooks for workflow management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workflowManager, Workflow } from '@/lib/agent/workflows'

// Types
export interface WorkflowCreateRequest {
  name: string
  description?: string
  steps?: any[]
  triggers?: any[]
  isActive?: boolean
}

export interface WorkflowUpdateRequest {
  name?: string
  description?: string
  steps?: any[]
  triggers?: any[]
  isActive?: boolean
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  userId: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: string
  completedAt?: string
  currentStep: number
  results: Record<string, any>
  error?: string
  context: Record<string, any>
  steps?: any[]
  triggeredBy?: string
}

export interface WorkflowStats {
  total: number
  active: number
  inactive: number
  totalRuns: number
  recentRuns: number
  averageRunTime: number
  successRate: number
}

// API functions
const fetchWorkflows = async (): Promise<Workflow[]> => {
  try {
    const user = await fetch('/api/auth/me').then(r => r.json())
    if (!user.success) {
      throw new Error('Unauthorized')
    }

    return await workflowManager.getWorkflowsForUser(user.data.id)
  } catch (error) {
    console.error('Error fetching workflows:', error)
    throw error
  }
}

const fetchWorkflow = async (workflowId: string): Promise<Workflow | null> => {
  try {
    const user = await fetch('/api/auth/me').then(r => r.json())
    if (!user.success) {
      throw new Error('Unauthorized')
    }

    return await workflowManager.getWorkflowById(workflowId, user.data.id)
  } catch (error) {
    console.error('Error fetching workflow:', error)
    throw error
  }
}

const createWorkflow = async (data: WorkflowCreateRequest): Promise<Workflow> => {
  const response = await fetch('/api/workflows', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(error || 'Failed to create workflow')
  }

  return response.json()
}

const updateWorkflow = async (workflowId: string, data: WorkflowUpdateRequest): Promise<Workflow> => {
  const response = await fetch(`/api/workflows/${workflowId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(error || 'Failed to update workflow')
  }

  return response.json()
}

const deleteWorkflow = async (workflowId: string): Promise<void> => {
  const response = await fetch(`/api/workflows/${workflowId}`, {
    method: 'DELETE'
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(error || 'Failed to delete workflow')
  }
}

const executeWorkflow = async (workflowId: string, context: Record<string, any> = {}): Promise<any> => {
  const response = await fetch(`/api/workflows/${workflowId}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ context })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(error || 'Failed to execute workflow')
  }

  return response.json()
}

const fetchWorkflowExecutions = async (workflowId: string, limit: number = 50): Promise<WorkflowExecution[]> => {
  try {
    const user = await fetch('/api/auth/me').then(r => r.json())
    if (!user.success) {
      throw new Error('Unauthorized')
    }

    return await workflowManager.getWorkflowExecutions(workflowId, user.data.id, limit)
  } catch (error) {
    console.error('Error fetching workflow executions:', error)
    throw error
  }
}

const fetchWorkflowStats = async (): Promise<WorkflowStats> => {
  try {
    const user = await fetch('/api/auth/me').then(r => r.json())
    if (!user.success) {
      throw new Error('Unauthorized')
    }

    const workflows = await workflowManager.getWorkflowsForUser(user.data.id)
    const executions = await Promise.all(
      workflows.slice(0, 10).map(workflow =>
        workflowManager.getWorkflowExecutions(workflow.id, user.data.id, 100)
      )
    )

    const total = workflows.length
    const active = workflows.filter(w => w.isActive).length
    const inactive = total - active
    const totalRuns = workflows.reduce((sum, w) => sum + w.runCount, 0)

    const allExecutions = executions.flat()
    const recentExecutions = allExecutions.filter(exec => {
      const execTime = new Date(exec.startedAt)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      return execTime > oneDayAgo
    })

    const successfulExecutions = allExecutions.filter(exec => exec.status === 'completed')
    const successRate = allExecutions.length > 0
      ? (successfulExecutions.length / allExecutions.length) * 100
      : 0

    const completedExecutions = allExecutions.filter(exec => exec.status === 'completed' && exec.completedAt)
    const runTimes = completedExecutions.map(exec => {
      const start = new Date(exec.startedAt).getTime()
      const end = new Date(exec.completedAt!).getTime()
      return end - start
    })
    const averageRunTime = runTimes.length > 0
      ? runTimes.reduce((sum, time) => sum + time, 0) / runTimes.length / 1000 // Convert to seconds
      : 0

    return {
      total,
      active,
      inactive,
      totalRuns,
      recentRuns: recentExecutions.length,
      averageRunTime: Math.round(averageRunTime * 100) / 100,
      successRate: Math.round(successRate * 100) / 100
    }
  } catch (error) {
    console.error('Error fetching workflow stats:', error)
    return {
      total: 0,
      active: 0,
      inactive: 0,
      totalRuns: 0,
      recentRuns: 0,
      averageRunTime: 0,
      successRate: 0
    }
  }
}

// Hooks
export const useWorkflows = () => {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: fetchWorkflows,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false
  })
}

export const useWorkflow = (workflowId: string) => {
  return useQuery({
    queryKey: ['workflows', workflowId],
    queryFn: () => fetchWorkflow(workflowId),
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    enabled: !!workflowId
  })
}

export const useCreateWorkflow = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      queryClient.invalidateQueries({ queryKey: ['workflow-stats'] })
    },
    onError: (error) => {
      console.error('Error creating workflow:', error)
    }
  })
}

export const useUpdateWorkflow = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: WorkflowUpdateRequest }) =>
      updateWorkflow(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      queryClient.invalidateQueries({ queryKey: ['workflows', id] })
      queryClient.invalidateQueries({ queryKey: ['workflow-stats'] })
    },
    onError: (error) => {
      console.error('Error updating workflow:', error)
    }
  })
}

export const useDeleteWorkflow = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      queryClient.invalidateQueries({ queryKey: ['workflow-stats'] })
    },
    onError: (error) => {
      console.error('Error deleting workflow:', error)
    }
  })
}

export const useExecuteWorkflow = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ workflowId, context }: { workflowId: string; context?: Record<string, any> }) =>
      executeWorkflow(workflowId, context),
    onSuccess: (_, { workflowId }) => {
      queryClient.invalidateQueries({ queryKey: ['workflows', workflowId] })
      queryClient.invalidateQueries({ queryKey: ['workflow-executions', workflowId] })
      queryClient.invalidateQueries({ queryKey: ['workflow-stats'] })
    },
    onError: (error) => {
      console.error('Error executing workflow:', error)
    }
  })
}

export const useWorkflowExecutions = (workflowId: string, limit: number = 50) => {
  return useQuery({
    queryKey: ['workflow-executions', workflowId, limit],
    queryFn: () => fetchWorkflowExecutions(workflowId, limit),
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 60 * 5, // Refresh every 5 minutes
    refetchOnWindowFocus: false,
    enabled: !!workflowId
  })
}

export const useWorkflowStats = () => {
  return useQuery({
    queryKey: ['workflow-stats'],
    queryFn: fetchWorkflowStats,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 60 * 5, // Refresh every 5 minutes
    refetchOnWindowFocus: false
  })
}

// Utility functions
export const formatWorkflowStatus = (status: string): { label: string; color: string; icon: string } => {
  switch (status) {
    case 'running':
      return { label: 'Running', color: 'blue', icon: '⏳' }
    case 'completed':
      return { label: 'Completed', color: 'green', icon: '✅' }
    case 'failed':
      return { label: 'Failed', color: 'red', icon: '❌' }
    case 'cancelled':
      return { label: 'Cancelled', color: 'orange', icon: '⏹️' }
    default:
      return { label: status, color: 'gray', icon: '❓' }
  }
}

export const formatExecutionDuration = (execution: WorkflowExecution): string => {
  if (!execution.completedAt) return 'Running...'

  const start = new Date(execution.startedAt).getTime()
  const end = new Date(execution.completedAt).getTime()
  const duration = end - start

  if (duration < 1000) {
    return `${duration}ms`
  } else if (duration < 60000) {
    return `${(duration / 1000).toFixed(1)}s`
  } else {
    const minutes = Math.floor(duration / 60000)
    const seconds = Math.floor((duration % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }
}

export const getWorkflowStepIcon = (stepType: string): string => {
  switch (stepType) {
    case 'tool':
      return '🔧'
    case 'condition':
      return '🔀'
    case 'delay':
      return '⏰'
    case 'action':
      return '⚡'
    case 'agent':
      return '🤖'
    case 'api_call':
      return '🌐'
    case 'webhook':
      return '🔗'
    default:
      return '📋'
  }
}

export const getWorkflowStepDescription = (step: any): string => {
  switch (step.type) {
    case 'tool':
      return `Execute ${step.config?.toolName || 'tool'}`
    case 'condition':
      return `Check condition: ${step.config?.condition || 'unknown'}`
    case 'delay':
      return `Delay for ${step.config?.delayMs || 0}ms`
    case 'action':
      return `Perform action: ${step.config?.action || 'unknown'}`
    case 'agent':
      return `Run agent: ${step.config?.agentName || 'Agent'}`
    case 'api_call':
      return `API call: ${step.config?.url || 'unknown'}`
    case 'webhook':
      return `Webhook: ${step.config?.url || 'unknown'}`
    default:
      return step.name || 'Unknown step'
  }
}