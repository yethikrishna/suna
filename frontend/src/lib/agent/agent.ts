/**
 * y0 Agent Core Logic
 * Core agent functionality converted from Python to TypeScript
 */

import { blink } from '@/lib/blink/client'
import { executeTool, getAllToolSchemas } from '@/lib/agent/tools'

export interface Agent {
  id: string
  name: string
  description: string
  config: Record<string, any>
  tools: string[]
  userId: string
  createdAt: Date
  updatedAt: Date
  isActive: boolean
}

export interface AgentExecution {
  id: string
  agentId: string
  userId: string
  input: string
  status: 'running' | 'completed' | 'failed'
  startedAt: Date
  completedAt?: Date
  results?: Record<string, any>
  error?: string
  context: Record<string, any>
  tools: string[]
}

export interface AgentConfig {
  maxTokens?: number
  temperature?: number
  model?: string
  systemPrompt?: string
  toolChoice?: 'auto' | 'none' | 'required'
  responseFormat?: 'text' | 'json'
}

/**
 * Agent Manager class for handling agent operations
 */
export class AgentManager {
  /**
   * Get all agents for a user
   */
  async getAgentsForUser(userId: string): Promise<Agent[]> {
    try {
      const agents = await blink.db.agents?.list({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      }) || []

      return agents.map(this.mapDbRecordToAgent)
    } catch (error) {
      console.error('Error getting agents for user:', error)
      throw new Error(`Failed to get agents: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get a specific agent by ID
   */
  async getAgentById(agentId: string, userId: string): Promise<Agent | null> {
    try {
      const agents = await blink.db.agents?.list({
        where: { id: agentId, userId }
      }) || []

      if (agents.length === 0) {
        return null
      }

      return this.mapDbRecordToAgent(agents[0])
    } catch (error) {
      console.error('Error getting agent by ID:', error)
      throw new Error(`Failed to get agent: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create a new agent
   */
  async createAgent(agentData: Partial<Agent>, userId: string): Promise<Agent> {
    try {
      const agent = await blink.db.agents?.create({
        name: agentData.name || 'New Agent',
        description: agentData.description || '',
        config: agentData.config || this.getDefaultConfig(),
        tools: agentData.tools || [],
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: agentData.isActive !== undefined ? agentData.isActive : true
      })

      if (!agent) {
        throw new Error('Failed to create agent')
      }

      return this.mapDbRecordToAgent(agent)
    } catch (error) {
      console.error('Error creating agent:', error)
      throw new Error(`Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Update an existing agent
   */
  async updateAgent(agentId: string, userId: string, updates: Partial<Agent>): Promise<Agent> {
    try {
      // Verify ownership
      const existingAgent = await this.getAgentById(agentId, userId)
      if (!existingAgent) {
        throw new Error('Agent not found')
      }

      const updateData: Record<string, any> = {
        updatedAt: new Date(),
        ...(updates.name && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.config && { config: updates.config }),
        ...(updates.tools && { tools: updates.tools }),
        ...(updates.isActive !== undefined && { isActive: updates.isActive })
      }

      const updatedAgent = await blink.db.agents?.update(agentId, updateData)

      if (!updatedAgent) {
        throw new Error('Failed to update agent')
      }

      return this.mapDbRecordToAgent(updatedAgent)
    } catch (error) {
      console.error('Error updating agent:', error)
      throw new Error(`Failed to update agent: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete an agent
   */
  async deleteAgent(agentId: string, userId: string): Promise<void> {
    try {
      // Verify ownership
      const existingAgent = await this.getAgentById(agentId, userId)
      if (!existingAgent) {
        throw new Error('Agent not found')
      }

      await blink.db.agents?.delete(agentId)
    } catch (error) {
      console.error('Error deleting agent:', error)
      throw new Error(`Failed to delete agent: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Execute an agent
   */
  async executeAgent(agentId: string, userId: string, input: string, context: Record<string, any> = {}): Promise<string> {
    try {
      // Get agent configuration
      const agent = await this.getAgentById(agentId, userId)
      if (!agent) {
        throw new Error('Agent not found')
      }

      if (!agent.isActive) {
        throw new Error('Agent is not active')
      }

      // Create execution record
      const execution = await blink.db.agentRuns?.create({
        agentId,
        userId,
        input,
        status: 'running',
        startedAt: new Date(),
        context,
        tools: agent.tools
      })

      if (!execution) {
        throw new Error('Failed to create execution record')
      }

      const executionId = execution.id

      try {
        // Process input with available tools
        const results = await this.processAgentInput(agent, input, context)

        // Update execution record with results
        await blink.db.agentRuns?.update(executionId, {
          status: 'completed',
          results,
          completedAt: new Date()
        })

        return results.response || 'Execution completed successfully'
      } catch (error) {
        // Update execution record with error
        await blink.db.agentRuns?.update(executionId, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Execution failed',
          completedAt: new Date()
        })

        throw error
      }
    } catch (error) {
      console.error('Error executing agent:', error)
      throw new Error(`Failed to execute agent: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get execution history for an agent
   */
  async getAgentExecutions(agentId: string, userId: string, limit: number = 50): Promise<AgentExecution[]> {
    try {
      const executions = await blink.db.agentRuns?.list({
        where: { agentId, userId },
        orderBy: { startedAt: 'desc' },
        limit
      }) || []

      return executions.map(this.mapDbRecordToExecution)
    } catch (error) {
      console.error('Error getting agent executions:', error)
      throw new Error(`Failed to get executions: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Process agent input using available tools
   */
  private async processAgentInput(agent: Agent, input: string, context: Record<string, any>): Promise<Record<string, any>> {
    const results: Record<string, any> = {
      toolResults: [],
      response: '',
      processedTools: []
    }

    // Determine which tools to use based on input and agent configuration
    const toolsToUse = this.selectTools(agent.tools, input, context)

    // Execute tools sequentially
    for (const toolName of toolsToUse) {
      try {
        console.log(`Agent ${agent.id}: Executing tool ${toolName}`)

        const toolResult = await executeTool(toolName, {
          query: input,
          ...context
        })

        results.toolResults.push({
          tool: toolName,
          result: toolResult,
          success: true,
          timestamp: new Date().toISOString()
        })

        results.processedTools.push(toolName)
      } catch (toolError) {
        console.error(`Agent ${agent.id}: Tool ${toolName} failed:`, toolError)

        results.toolResults.push({
          tool: toolName,
          error: toolError instanceof Error ? toolError.message : 'Tool execution failed',
          success: false,
          timestamp: new Date().toISOString()
        })
      }
    }

    // Generate AI response using Blink SDK
    try {
      const systemPrompt = agent.config.systemPrompt || this.getDefaultSystemPrompt()
      const maxTokens = agent.config.maxTokens || 1000
      const temperature = agent.config.temperature || 0.7

      const aiResponse = await blink.ai.generateText({
        prompt: `${systemPrompt}

User Input: ${input}

${results.toolResults.length > 0 ? `Tool Results: ${JSON.stringify(results.toolResults, null, 2)}` : ''}

Please provide a helpful response based on the user input and any tool results.`,
        maxTokens,
        temperature,
        model: agent.config.model
      })

      results.response = aiResponse.text
    } catch (aiError) {
      console.error('Agent AI response generation failed:', aiError)
      results.response = 'I apologize, but I encountered an error while generating a response.'
    }

    return results
  }

  /**
   * Select appropriate tools based on input and agent configuration
   */
  private selectTools(agentTools: string[], input: string, context: Record<string, any>): string[] {
    const toolSchemas = getAllToolSchemas()
    const availableTools = Object.keys(toolSchemas)
    const normalizedInput = input.toLowerCase()

    // Filter tools based on agent configuration and input
    return agentTools.filter(tool => {
      if (!availableTools.includes(tool)) {
        return false
      }

      // Simple heuristic-based selection
      const toolName = tool.toLowerCase()

      if (toolName.includes('search') || this.containsAny(normalizedInput, ['search', 'find', 'information', 'latest'])) {
        return true
      }

      if (toolName.includes('scrape') || this.containsAny(normalizedInput, ['scrape', 'extract', 'website', 'url'])) {
        return true
      }

      if (toolName.includes('linkedin') || this.containsAny(normalizedInput, ['linkedin', 'profile', 'job', 'professional'])) {
        return true
      }

      if (toolName.includes('twitter') || this.containsAny(normalizedInput, ['twitter', 'tweet', 'social media'])) {
        return true
      }

      if (toolName.includes('amazon') || this.containsAny(normalizedInput, ['amazon', 'product', 'buy', 'price'])) {
        return true
      }

      if ((toolName.includes('yahoo') || toolName.includes('finance')) && this.containsAny(normalizedInput, ['stock', 'finance', 'market', 'money'])) {
        return true
      }

      if (toolName.includes('zillow') || this.containsAny(normalizedInput, ['zillow', 'real estate', 'property', 'house'])) {
        return true
      }

      return false
    })
  }

  /**
   * Check if text contains any of the specified keywords
   */
  private containsAny(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword))
  }

  /**
   * Get default agent configuration
   */
  private getDefaultConfig(): AgentConfig {
    return {
      maxTokens: 1000,
      temperature: 0.7,
      model: 'claude-3-sonnet',
      systemPrompt: this.getDefaultSystemPrompt(),
      toolChoice: 'auto',
      responseFormat: 'text'
    }
  }

  /**
   * Get default system prompt
   */
  private getDefaultSystemPrompt(): string {
    return `You are y0, an intelligent generalist AI assistant. You help users accomplish real-world tasks using your available tools.

When you use tools, analyze their results carefully and provide clear, helpful responses. Always be honest about what you can and cannot do.

Your capabilities include:
- Web search and information gathering
- Web scraping and content extraction
- Social media data analysis (LinkedIn, Twitter)
- E-commerce data (Amazon)
- Financial market data (Yahoo Finance)
- Real estate information (Zillow)

Be helpful, accurate, and thorough in your responses.`
  }

  /**
   * Map database record to Agent interface
   */
  private mapDbRecordToAgent(record: any): Agent {
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      config: record.config || {},
      tools: record.tools || [],
      userId: record.userId,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      isActive: record.isActive !== false
    }
  }

  /**
   * Map database record to AgentExecution interface
   */
  private mapDbRecordToExecution(record: any): AgentExecution {
    return {
      id: record.id,
      agentId: record.agentId,
      userId: record.userId,
      input: record.input,
      status: record.status,
      startedAt: new Date(record.startedAt),
      completedAt: record.completedAt ? new Date(record.completedAt) : undefined,
      results: record.results || undefined,
      error: record.error || undefined,
      context: record.context || {},
      tools: record.tools || []
    }
  }
}

// Export singleton instance
export const agentManager = new AgentManager()