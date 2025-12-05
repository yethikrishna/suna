/**
 * y0 Agent Execution API Route
 * Handles agent execution using Blink SDK and converted agent tools
 */

import { NextRequest, NextResponse } from 'next/server'
import { blink } from '@/lib/blink/client'
import { executeTool, getAllToolSchemas } from '@/lib/agent/tools'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get current user
    const user = await blink.auth.me()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const agentId = params.id

    // Get agent configuration
    const agents = await blink.db.agents?.list({
      where: {
        id: agentId,
        userId: user.id,
        isActive: true
      }
    })

    if (!agents || agents.length === 0) {
      return NextResponse.json(
        { error: 'Agent not found or inactive' },
        { status: 404 }
      )
    }

    const agent = agents[0]

    // Parse execution request
    const body = await request.json()
    const { input, tools: requestedTools, context } = body

    if (!input) {
      return NextResponse.json(
        { error: 'Input is required for agent execution' },
        { status: 400 }
      )
    }

    // Create execution record
    const execution = await blink.db.agentRuns?.create({
      agentId: agentId,
      userId: user.id,
      input,
      status: 'running',
      startedAt: new Date(),
      context: context || {},
      tools: requestedTools || agent.tools || []
    })

    if (!execution) {
      throw new Error('Failed to create execution record')
    }

    // Execute agent logic in background
    executeAgentLogic(execution.id, agent, input, requestedTools || agent.tools || [], context || {})
      .catch(error => {
        console.error('Agent execution failed:', error)
        // Update execution record with error
        blink.db.agentRuns?.update(execution.id, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date()
        })
      })

    return NextResponse.json({
      success: true,
      data: {
        executionId: execution.id,
        status: 'running',
        message: 'Agent execution started'
      }
    })

  } catch (error) {
    console.error('Error starting agent execution:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start agent execution'
      },
      { status: 500 }
    )
  }
}

async function executeAgentLogic(
  executionId: string,
  agent: any,
  input: string,
  tools: string[],
  context: Record<string, any>
) {
  try {
    console.log(`Executing agent ${agent.id} with execution ${executionId}`)

    // Process the input using available tools
    const results = []
    const toolSchemas = getAllToolSchemas()

    // Simple agent logic - process input and execute relevant tools
    const processedInput = input.toLowerCase()

    // Check if any tools should be executed based on input
    for (const toolName of Object.keys(toolSchemas)) {
      if (shouldExecuteTool(toolName, processedInput, tools)) {
        console.log(`Executing tool: ${toolName}`)

        try {
          const toolResult = await executeTool(toolName, {
            query: input,
            ...context
          })

          results.push({
            tool: toolName,
            result: toolResult,
            success: true
          })

        } catch (toolError) {
          console.error(`Tool ${toolName} execution failed:`, toolError)
          results.push({
            tool: toolName,
            error: toolError instanceof Error ? toolError.message : 'Tool execution failed',
            success: false
          })
        }
      }
    }

    // Generate AI response using Blink SDK
    const aiResponse = await blink.ai.generateText({
      prompt: `You are y0, an AI assistant. Based on the user input: "${input}"${results.length > 0 ? ` and the following tool results: ${JSON.stringify(results, null, 2)}` : ''}, provide a helpful response. If tools were executed, analyze and summarize their results.`,
      maxTokens: 1000
    })

    // Update execution record with results
    await blink.db.agentRuns?.update(executionId, {
      status: 'completed',
      results: {
        toolResults: results,
        aiResponse: aiResponse.text
      },
      completedAt: new Date()
    })

    console.log(`Agent execution ${executionId} completed successfully`)

  } catch (error) {
    console.error(`Agent execution ${executionId} failed:`, error)
    throw error
  }
}

function shouldExecuteTool(toolName: string, input: string, availableTools: string[]): boolean {
  // Check if tool is available
  if (!availableTools.includes(toolName)) {
    return false
  }

  // Simple heuristic-based tool selection
  const searchKeywords = ['search', 'find', 'look up', 'information', 'latest', 'news']
  const scrapeKeywords = ['scrape', 'extract', 'get content', 'website', 'url']
  const linkedinKeywords = ['linkedin', 'profile', 'job', 'company', 'professional']
  const twitterKeywords = ['twitter', 'tweet', 'social media', 'x.com']
  const amazonKeywords = ['amazon', 'product', 'buy', 'price', 'review']
  const financeKeywords = ['stock', 'finance', 'market', 'yahoo', 'money', 'investment']
  const zillowKeywords = ['zillow', 'real estate', 'property', 'house', 'home']

  const normalizedToolName = toolName.toLowerCase()

  if (normalizedToolName.includes('search') || searchKeywords.some(keyword => input.includes(keyword))) {
    return true
  }

  if (normalizedToolName.includes('scrape') || scrapeKeywords.some(keyword => input.includes(keyword))) {
    return true
  }

  if (normalizedToolName.includes('linkedin') || linkedinKeywords.some(keyword => input.includes(keyword))) {
    return true
  }

  if (normalizedToolName.includes('twitter') || twitterKeywords.some(keyword => input.includes(keyword))) {
    return true
  }

  if (normalizedToolName.includes('amazon') || amazonKeywords.some(keyword => input.includes(keyword))) {
    return true
  }

  if ((normalizedToolName.includes('yahoo') || normalizedToolName.includes('finance')) &&
      financeKeywords.some(keyword => input.includes(keyword))) {
    return true
  }

  if (normalizedToolName.includes('zillow') || zillowKeywords.some(keyword => input.includes(keyword))) {
    return true
  }

  return false
}