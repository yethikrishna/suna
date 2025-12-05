/**
 * y0 Cron Job Webhook Handler
 * Receives webhooks from cron-job.org and triggers scheduled workflows
 * Replaces QStash webhook system
 */

import { NextRequest, NextResponse } from 'next/server'
import { blink } from '@/lib/blink/client'
import { cronJobManager } from '@/lib/cron/cron-manager'

export async function POST(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    const { workflowId } = params

    console.log(`[Cron Webhook] Received trigger for workflow: ${workflowId}`)

    // Get request data
    const requestData = await request.json()
    console.log(`[Cron Webhook] Request data:`, JSON.stringify(requestData, null, 2))

    // Get cron job from database
    const cronJobs = await blink.db.cronJobs?.list({
      where: { workflowId, isActive: true }
    }) || []

    if (cronJobs.length === 0) {
      console.log(`[Cron Webhook] No active cron jobs found for workflow: ${workflowId}`)
      return NextResponse.json(
        { error: 'No active cron jobs found for this workflow' },
        { status: 404 }
      )
    }

    // Get the workflow
    const workflow = await blink.db.workflows?.findById(workflowId)
    if (!workflow) {
      console.log(`[Cron Webhook] Workflow not found: ${workflowId}`)
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    console.log(`[Cron Webhook] Found workflow: ${workflow.name} (${workflow.id})`)

    // Execute the workflow
    const execution = await executeWorkflow(workflow, {
      triggeredBy: 'cron',
      cronData: requestData,
      timestamp: new Date().toISOString()
    })

    // Update cron job execution stats
    for (const cronJob of cronJobs) {
      await blink.db.cronJobs?.update(cronJob.id, {
        lastRun: new Date(),
        nextRun: cronJobManager.getNextRunTime(cronJob.schedule, cronJob.timezone) || undefined,
        runCount: cronJob.runCount + 1,
        updatedAt: new Date()
      })
    }

    console.log(`[Cron Webhook] Workflow execution completed: ${execution.id}`)

    return NextResponse.json({
      success: true,
      executionId: execution.id,
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: execution.status,
      triggeredAt: new Date().toISOString(),
      cronJobsUpdated: cronJobs.length
    })

  } catch (error) {
    console.error('[Cron Webhook] Error:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

/**
 * Execute a workflow
 */
async function executeWorkflow(workflow: any, triggerContext: any) {
  try {
    console.log(`[Workflow] Starting execution: ${workflow.name}`)

    // Create execution record
    const execution = await blink.db.workflowExecutions?.create({
      workflowId: workflow.id,
      userId: workflow.userId,
      status: 'running',
      startedAt: new Date(),
      input: triggerContext,
      steps: workflow.steps || [],
      currentStep: 0,
      metadata: {
        triggeredBy: 'cron',
        timestamp: new Date().toISOString()
      }
    })

    if (!execution) {
      throw new Error('Failed to create workflow execution record')
    }

    console.log(`[Workflow] Created execution: ${execution.id}`)

    // Execute workflow steps
    const steps = workflow.steps || []
    let currentStep = 0
    const results: any[] = []

    for (const step of steps) {
      currentStep++

      console.log(`[Workflow] Executing step ${currentStep}/${steps.length}: ${step.name || step.type}`)

      try {
        const stepResult = await executeWorkflowStep(step, workflow, execution.id)
        results.push({
          step: currentStep,
          type: step.type,
          name: step.name || `Step ${currentStep}`,
          status: 'completed',
          result: stepResult,
          executedAt: new Date().toISOString()
        })

        console.log(`[Workflow] Step ${currentStep} completed successfully`)
      } catch (stepError) {
        console.error(`[Workflow] Step ${currentStep} failed:`, stepError)

        // Check if workflow should continue on error
        if (step.continueOnError) {
          results.push({
            step: currentStep,
            type: step.type,
            name: step.name || `Step ${currentStep}`,
            status: 'failed',
            error: stepError instanceof Error ? stepError.message : 'Unknown error',
            executedAt: new Date().toISOString()
          })
          continue
        } else {
          // Stop execution and mark as failed
          await blink.db.workflowExecutions?.update(execution.id, {
            status: 'failed',
            completedAt: new Date(),
            currentStep,
            results,
            error: stepError instanceof Error ? stepError.message : 'Workflow step failed'
          })

          throw new Error(`Workflow failed at step ${currentStep}: ${stepError instanceof Error ? stepError.message : 'Unknown error'}`)
        }
      }

      // Update execution progress
      await blink.db.workflowExecutions?.update(execution.id, {
        currentStep,
        results: [...results]
      })
    }

    // Mark execution as completed
    await blink.db.workflowExecutions?.update(execution.id, {
      status: 'completed',
      completedAt: new Date(),
      currentStep: steps.length,
      results
    })

    console.log(`[Workflow] Execution completed successfully: ${execution.id}`)

    return {
      ...execution,
      status: 'completed',
      completedAt: new Date(),
      results
    }

  } catch (error) {
    console.error('[Workflow] Execution failed:', error)
    throw error
  }
}

/**
 * Execute a single workflow step
 */
async function executeWorkflowStep(step: any, workflow: any, executionId: string): Promise<any> {
  switch (step.type) {
    case 'agent':
      return await executeAgentStep(step, workflow)
    case 'api_call':
      return await executeApiCallStep(step)
    case 'condition':
      return await executeConditionStep(step)
    case 'delay':
      return await executeDelayStep(step)
    case 'webhook':
      return await executeWebhookStep(step)
    default:
      throw new Error(`Unknown step type: ${step.type}`)
  }
}

/**
 * Execute an agent step
 */
async function executeAgentStep(step: any, workflow: any): Promise<any> {
  console.log(`[Step] Executing agent step: ${step.agentId}`)

  const agent = await blink.db.agents?.findById(step.agentId)
  if (!agent) {
    throw new Error(`Agent not found: ${step.agentId}`)
  }

  if (agent.userId !== workflow.userId) {
    throw new Error(`Agent access denied: ${step.agentId}`)
  }

  // Import agent manager
  const { AgentManager } = await import('@/lib/agent/agent')
  const agentManager = new AgentManager()

  // Execute agent with provided input or default input
  const input = step.input || workflow.defaultInput || 'Execute scheduled task'
  const result = await agentManager.executeAgent(agent.id, workflow.userId, input, {
    workflowId: workflow.id,
    stepType: 'cron-triggered'
  })

  console.log(`[Step] Agent execution completed: ${result.length} characters`)

  return {
    type: 'agent',
    agentId: agent.id,
    agentName: agent.name,
    input,
    output: result,
    tokensUsed: result.length, // Rough estimate
    executedAt: new Date().toISOString()
  }
}

/**
 * Execute an API call step
 */
async function executeApiCallStep(step: any): Promise<any> {
  console.log(`[Step] Executing API call step: ${step.method} ${step.url}`)

  const { method, url, headers, body, timeout = 30000 } = step.config

  const response = await fetch(url, {
    method: method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'y0-workflow-agent/1.0',
      ...(headers || {})
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout)
  })

  let responseData
  const contentType = response.headers.get('content-type')

  if (contentType && contentType.includes('application/json')) {
    responseData = await response.json()
  } else {
    responseData = await response.text()
  }

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`)
  }

  console.log(`[Step] API call completed: ${response.status}`)

  return {
    type: 'api_call',
    method,
    url,
    status: response.status,
    response: responseData,
    executedAt: new Date().toISOString()
  }
}

/**
 * Execute a condition step
 */
async function executeConditionStep(step: any): Promise<any> {
  console.log(`[Step] Executing condition step`)

  // Simple condition evaluation - in production, you'd use a safer expression evaluator
  const condition = step.condition
  let result = false

  try {
    // This is a simplified implementation
    // In production, use a proper expression parser/evaluator
    if (typeof condition === 'string') {
      // Very basic evaluation - DO NOT use eval() in production!
      result = eval(condition)
    } else if (typeof condition === 'boolean') {
      result = condition
    }
  } catch (error) {
    throw new Error(`Condition evaluation failed: ${error}`)
  }

  console.log(`[Step] Condition evaluated: ${result}`)

  return {
    type: 'condition',
    condition: step.condition,
    result,
    executedAt: new Date().toISOString()
  }
}

/**
 * Execute a delay step
 */
async function executeDelayStep(step: any): Promise<any> {
  console.log(`[Step] Executing delay step: ${step.duration}ms`)

  const duration = step.duration || 1000

  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`[Step] Delay completed: ${duration}ms`)

      resolve({
        type: 'delay',
        duration,
        executedAt: new Date().toISOString()
      })
    }, duration)
  })
}

/**
 * Execute a webhook step
 */
async function executeWebhookStep(step: any): Promise<any> {
  console.log(`[Step] Executing webhook step: ${step.url}`)

  const { url, method = 'POST', headers, body, timeout = 30000 } = step.config

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'y0-workflow-webhook/1.0',
      ...(headers || {})
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout)
  })

  let responseData
  const contentType = response.headers.get('content-type')

  if (contentType && contentType.includes('application/json')) {
    responseData = await response.json()
  } else {
    responseData = await response.text()
  }

  if (!response.ok) {
    throw new Error(`Webhook call failed: ${response.status} ${response.statusText}`)
  }

  console.log(`[Step] Webhook completed: ${response.status}`)

  return {
    type: 'webhook',
    url,
    method,
    status: response.status,
    response: responseData,
    executedAt: new Date().toISOString()
  }
}