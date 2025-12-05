/**
 * y0 Workflow System
 * Workflow automation converted from Python to TypeScript
 */

import { blink } from '@/lib/blink/client'
import { executeTool } from '@/lib/agent/tools'

export interface Workflow {
  id: string
  name: string
  description: string
  steps: WorkflowStep[]
  triggers: WorkflowTrigger[]
  userId: string
  createdAt: Date
  updatedAt: Date
  isActive: boolean
  lastRun?: Date
  runCount: number
}

export interface WorkflowStep {
  id: string
  name: string
  type: 'tool' | 'condition' | 'delay' | 'action'
  config: Record<string, any>
  condition?: string
  order: number
}

export interface WorkflowTrigger {
  id: string
  type: 'manual' | 'schedule' | 'event' | 'webhook'
  config: Record<string, any>
  isActive: boolean
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  userId: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: Date
  completedAt?: Date
  currentStep: number
  results: Record<string, any>
  error?: string
  context: Record<string, any>
}

/**
 * Workflow Manager class
 */
export class WorkflowManager {
  /**
   * Get all workflows for a user
   */
  async getWorkflowsForUser(userId: string): Promise<Workflow[]> {
    try {
      const workflows = await blink.db.workflows?.list({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      }) || []

      return workflows.map(this.mapDbRecordToWorkflow)
    } catch (error) {
      console.error('Error getting workflows for user:', error)
      throw new Error(`Failed to get workflows: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get a specific workflow by ID
   */
  async getWorkflowById(workflowId: string, userId: string): Promise<Workflow | null> {
    try {
      const workflows = await blink.db.workflows?.list({
        where: { id: workflowId, userId }
      }) || []

      if (workflows.length === 0) {
        return null
      }

      return this.mapDbRecordToWorkflow(workflows[0])
    } catch (error) {
      console.error('Error getting workflow by ID:', error)
      throw new Error(`Failed to get workflow: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create a new workflow
   */
  async createWorkflow(workflowData: Partial<Workflow>, userId: string): Promise<Workflow> {
    try {
      const workflow = await blink.db.workflows?.create({
        name: workflowData.name || 'New Workflow',
        description: workflowData.description || '',
        steps: workflowData.steps || [],
        triggers: workflowData.triggers || [],
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: workflowData.isActive !== undefined ? workflowData.isActive : true,
        runCount: 0
      })

      if (!workflow) {
        throw new Error('Failed to create workflow')
      }

      return this.mapDbRecordToWorkflow(workflow)
    } catch (error) {
      console.error('Error creating workflow:', error)
      throw new Error(`Failed to create workflow: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Update an existing workflow
   */
  async updateWorkflow(workflowId: string, userId: string, updates: Partial<Workflow>): Promise<Workflow> {
    try {
      // Verify ownership
      const existingWorkflow = await this.getWorkflowById(workflowId, userId)
      if (!existingWorkflow) {
        throw new Error('Workflow not found')
      }

      const updateData: Record<string, any> = {
        updatedAt: new Date(),
        ...(updates.name && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.steps && { steps: updates.steps }),
        ...(updates.triggers && { triggers: updates.triggers }),
        ...(updates.isActive !== undefined && { isActive: updates.isActive })
      }

      const updatedWorkflow = await blink.db.workflows?.update(workflowId, updateData)

      if (!updatedWorkflow) {
        throw new Error('Failed to update workflow')
      }

      return this.mapDbRecordToWorkflow(updatedWorkflow)
    } catch (error) {
      console.error('Error updating workflow:', error)
      throw new Error(`Failed to update workflow: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete a workflow
   */
  async deleteWorkflow(workflowId: string, userId: string): Promise<void> {
    try {
      // Verify ownership
      const existingWorkflow = await this.getWorkflowById(workflowId, userId)
      if (!existingWorkflow) {
        throw new Error('Workflow not found')
      }

      await blink.db.workflows?.delete(workflowId)
    } catch (error) {
      console.error('Error deleting workflow:', error)
      throw new Error(`Failed to delete workflow: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflowId: string, userId: string, context: Record<string, any> = {}): Promise<string> {
    try {
      // Get workflow configuration
      const workflow = await this.getWorkflowById(workflowId, userId)
      if (!workflow) {
        throw new Error('Workflow not found')
      }

      if (!workflow.isActive) {
        throw new Error('Workflow is not active')
      }

      // Create execution record
      const execution = await blink.db.workflowExecutions?.create({
        workflowId,
        userId,
        status: 'running',
        startedAt: new Date(),
        currentStep: 0,
        results: {},
        context,
        steps: workflow.steps || [],
        triggeredBy: context.triggeredBy || 'manual'
      })

      if (!execution) {
        throw new Error('Failed to create execution record')
      }

      const executionId = execution.id

      try {
        // Execute workflow steps
        const results = await this.executeWorkflowSteps(workflow, context, executionId)

        // Update execution record
        await blink.db.workflows?.update(workflowId, {
          lastRun: new Date(),
          runCount: workflow.runCount + 1
        })

        await blink.db.workflowExecutions?.update(executionId, {
          status: 'completed',
          results,
          completedAt: new Date()
        })

        return results.summary || 'Workflow executed successfully'
      } catch (error) {
        // Update execution record with error
        await blink.db.workflowExecutions?.update(executionId, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Workflow execution failed',
          completedAt: new Date()
        })

        throw error
      }
    } catch (error) {
      console.error('Error executing workflow:', error)
      throw new Error(`Failed to execute workflow: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Execute workflow steps with progress tracking
   */
  async executeWorkflowSteps(workflow: Workflow, context: Record<string, any>, executionId: string): Promise<Record<string, any>> {
    const results: Record<string, any> = {
      steps: [],
      summary: '',
      context: { ...context },
      startTime: new Date().toISOString()
    }

    // Sort steps by order
    const sortedSteps = [...workflow.steps].sort((a, b) => a.order - b.order)

    for (let i = 0; i < sortedSteps.length; i++) {
      const step = sortedSteps[i]

      try {
        console.log(`Workflow ${workflow.id}: Executing step ${i + 1}/${sortedSteps.length}: ${step.name}`)

        // Update current step progress
        await blink.db.workflowExecutions?.update(executionId, {
          currentStep: i + 1
        })

        const stepResult = await this.executeStep(step, results.context)

        results.steps.push({
          stepName: step.name,
          stepType: step.type,
          success: true,
          result: stepResult,
          timestamp: new Date().toISOString()
        })

        // Update context with step results
        results.context[`step_${i}_result`] = stepResult

        // Check if step failed and workflow should stop
        if (stepResult.continue === false) {
          break
        }

      } catch (stepError) {
        console.error(`Workflow ${workflow.id}: Step ${i + 1}/${sortedSteps.length} failed:`, stepError)

        results.steps.push({
          stepName: step.name,
          stepType: step.type,
          success: false,
          error: stepError instanceof Error ? stepError.message : 'Step execution failed',
          timestamp: new Date().toISOString()
        })

        // Check if we should continue on error
        if (step.config?.continueOnError !== true) {
          throw new Error(`Workflow failed at step "${step.name}": ${stepError instanceof Error ? stepError.message : 'Unknown error'}`)
        }
      }
    }

    results.endTime = new Date().toISOString()
    const successfulSteps = results.steps.filter(s => s.success).length
    const failedSteps = results.steps.filter(s => !s.success).length
    results.summary = `Workflow executed with ${results.steps.length} steps. Success: ${successfulSteps}, Failed: ${failedSteps}`

    return results
  }

  /**
   * Execute workflow steps
   */
  private async executeWorkflowSteps(workflow: Workflow, context: Record<string, any>): Promise<Record<string, any>> {
    const results: Record<string, any> = {
      steps: [],
      summary: '',
      context: { ...context },
      startTime: new Date().toISOString()
    }

    // Sort steps by order
    const sortedSteps = [...workflow.steps].sort((a, b) => a.order - b.order)

    for (let i = 0; i < sortedSteps.length; i++) {
      const step = sortedSteps[i]

      try {
        console.log(`Workflow ${workflow.id}: Executing step ${i + 1}/${sortedSteps.length}: ${step.name}`)

        const stepResult = await this.executeStep(step, results.context)

        results.steps.push({
          stepName: step.name,
          stepType: step.type,
          success: true,
          result: stepResult,
          timestamp: new Date().toISOString()
        })

        // Update context with step results
        results.context[`step_${i}_result`] = stepResult

        // Check if step failed and workflow should stop
        if (stepResult.continue === false) {
          break
        }

      } catch (stepError) {
        console.error(`Workflow ${workflow.id}: Step ${i + 1}/${sortedSteps.length} failed:`, stepError)

        results.steps.push({
          stepName: step.name,
          stepType: step.type,
          success: false,
          error: stepError instanceof Error ? stepError.message : 'Step execution failed',
          timestamp: new Date().toISOString()
        })

        // Continue execution even if step fails (could be configured)
      }
    }

    results.endTime = new Date().toISOString()
    results.summary = `Workflow executed with ${results.steps.length} steps. Success: ${results.steps.filter(s => s.success).length}, Failed: ${results.steps.filter(s => !s.success).length}`

    return results
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(step: WorkflowStep, context: Record<string, any>): Promise<Record<string, any>> {
    switch (step.type) {
      case 'tool':
        return await this.executeToolStep(step, context)

      case 'condition':
        return await this.executeConditionStep(step, context)

      case 'delay':
        return await this.executeDelayStep(step, context)

      case 'action':
        return await this.executeActionStep(step, context)

      default:
        throw new Error(`Unknown step type: ${step.type}`)
    }
  }

  /**
   * Execute a tool step
   */
  private async executeToolStep(step: WorkflowStep, context: Record<string, any>): Promise<Record<string, any>> {
    const { toolName, parameters } = step.config

    if (!toolName) {
      throw new Error('Tool step missing toolName')
    }

    // Substitute variables in parameters
    const processedParams = this.substituteVariables(parameters || {}, context)

    const result = await executeTool(toolName, processedParams)

    return {
      tool: toolName,
      parameters: processedParams,
      result,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Execute a condition step
   */
  private async executeConditionStep(step: WorkflowStep, context: Record<string, any>): Promise<Record<string, any>> {
    const { condition, expression } = step.config

    let result = false

    if (condition) {
      // Simple condition evaluation
      result = this.evaluateCondition(condition, context)
    } else if (expression) {
      // More complex expression evaluation
      result = this.evaluateExpression(expression, context)
    }

    return {
      condition,
      expression,
      result,
      continue: result, // Continue workflow only if condition is true
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Execute a delay step
   */
  private async executeDelayStep(step: WorkflowStep, context: Record<string, any>): Promise<Record<string, any>> {
    const { delayMs } = step.config

    if (!delayMs || typeof delayMs !== 'number') {
      throw new Error('Delay step missing valid delayMs')
    }

    // Wait for specified duration
    await new Promise(resolve => setTimeout(resolve, delayMs))

    return {
      delayMs,
      message: `Delayed for ${delayMs}ms`,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Execute an action step
   */
  private async executeActionStep(step: WorkflowStep, context: Record<string, any>): Promise<Record<string, any>> {
    const { action, parameters } = step.config

    switch (action) {
      case 'send_notification':
        return await this.sendNotificationAction(parameters, context)

      case 'create_report':
        return await this.createReportAction(parameters, context)

      case 'update_database':
        return await this.updateDatabaseAction(parameters, context)

      default:
        throw new Error(`Unknown action: ${action}`)
    }
  }

  /**
   * Send notification action
   */
  private async sendNotificationAction(parameters: Record<string, any>, context: Record<string, any>): Promise<Record<string, any>> {
    // This would use Blink SDK notifications
    return {
      action: 'send_notification',
      parameters,
      status: 'completed',
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Create report action
   */
  private async createReportAction(parameters: Record<string, any>, context: Record<string, any>): Promise<Record<string, any>> {
    const { reportType, data } = parameters

    // Create report using context and step results
    const report = {
      type: reportType || 'workflow_summary',
      data: data || context,
      generatedAt: new Date().toISOString()
    }

    // Store report in database
    try {
      await blink.db.reports?.create({
        userId: context.userId || 'unknown',
        type: reportType,
        data: report,
        createdAt: new Date()
      })
    } catch (error) {
      console.error('Failed to save report:', error)
    }

    return {
      action: 'create_report',
      report,
      status: 'completed',
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Update database action
   */
  private async updateDatabaseAction(parameters: Record<string, any>, context: Record<string, any>): Promise<Record<string, any>> {
    const { table, operation, data } = parameters

    // This would perform database operations using Blink SDK
    return {
      action: 'update_database',
      table,
      operation,
      data,
      status: 'completed',
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Evaluate simple condition
   */
  private evaluateCondition(condition: string, context: Record<string, any>): boolean {
    // Simple condition evaluation
    // This could be enhanced with a proper expression parser
    const [field, operator, value] = condition.split(' ')

    if (field && operator && value) {
      const contextValue = this.getContextValue(field, context)

      switch (operator.toLowerCase()) {
        case '==':
        case '=':
          return contextValue == value
        case '!=':
          return contextValue != value
        case '>':
          return Number(contextValue) > Number(value)
        case '<':
          return Number(contextValue) < Number(value)
        case '>=':
          return Number(contextValue) >= Number(value)
        case '<=':
          return Number(contextValue) <= Number(value)
        case 'contains':
          return String(contextValue).includes(value)
        default:
          return false
      }
    }

    return false
  }

  /**
   * Evaluate expression
   */
  private evaluateExpression(expression: string, context: Record<string, any>): boolean {
    // This would use a proper expression parser
    // For now, return false for complex expressions
    return false
  }

  /**
   * Get value from context
   */
  private getContextValue(path: string, context: Record<string, any>): any {
    const parts = path.split('.')
    let value = context

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part]
      } else {
        return undefined
      }
    }

    return value
  }

  /**
   * Substitute variables in parameters
   */
  private substituteVariables(parameters: Record<string, any>, context: Record<string, any>): Record<string, any> {
    const substituted: Record<string, any> = {}

    for (const [key, value] of Object.entries(parameters)) {
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        const variablePath = value.slice(2, -2).trim()
        substituted[key] = this.getContextValue(variablePath, context) || value
      } else {
        substituted[key] = value
      }
    }

    return substituted
  }

  /**
   * Get workflow execution history
   */
  async getWorkflowExecutions(workflowId: string, userId: string, limit: number = 50): Promise<WorkflowExecution[]> {
    try {
      const executions = await blink.db.workflowExecutions?.list({
        where: { workflowId, userId },
        orderBy: { startedAt: 'desc' },
        limit
      }) || []

      return executions.map(this.mapDbRecordToExecution)
    } catch (error) {
      console.error('Error getting workflow executions:', error)
      throw new Error(`Failed to get executions: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Map database record to Workflow interface
   */
  private mapDbRecordToWorkflow(record: any): Workflow {
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      steps: record.steps || [],
      triggers: record.triggers || [],
      userId: record.userId,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      isActive: record.isActive !== false,
      lastRun: record.lastRun ? new Date(record.lastRun) : undefined,
      runCount: record.runCount || 0
    }
  }

  /**
   * Map database record to WorkflowExecution interface
   */
  private mapDbRecordToExecution(record: any): WorkflowExecution {
    return {
      id: record.id,
      workflowId: record.workflowId,
      userId: record.userId,
      status: record.status,
      startedAt: new Date(record.startedAt),
      completedAt: record.completedAt ? new Date(record.completedAt) : undefined,
      currentStep: record.currentStep || 0,
      results: record.results || {},
      error: record.error || undefined,
      context: record.context || {}
    }
  }
}

// Export singleton instance
export const workflowManager = new WorkflowManager()