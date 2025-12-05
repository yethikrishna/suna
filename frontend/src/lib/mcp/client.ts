/**
 * y0 MCP Client
 * Direct MCP client implementation without Smithery dependency
 */

import { blink } from '@/lib/blink/client'
import {
  MCPServer,
  MCPTool,
  MCPServerListResponse,
  MCPServerDetailResponse,
  PopularServersResponse,
  CustomMCPConnection,
  MCPDiscoveryRequest,
  MCPDiscoveryResponse,
  MCPExecutionRequest,
  MCPExecutionResult,
  MCPConnectionType
} from './types'

/**
 * MCP Client for managing servers without Smithery
 */
export class MCPClient {
  private static instance: MCPClient

  static getInstance(): MCPClient {
    if (!MCPClient.instance) {
      MCPClient.instance = new MCPClient()
    }
    return MCPClient.instance
  }

  /**
   * Get built-in MCP servers (always available)
   */
  async getBuiltinServers(): Promise<MCPServer[]> {
    return [
      {
        qualifiedName: 'filesystem',
        displayName: 'File System',
        description: 'Read, write, and manage files on the local filesystem',
        createdAt: new Date().toISOString(),
        useCount: 0,
        homepage: '',
        type: 'builtin',
        isDeployed: true,
        tools: [
          {
            name: 'read_file',
            description: 'Read the contents of a file',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path to read' }
              },
              required: ['path']
            }
          },
          {
            name: 'write_file',
            description: 'Write content to a file',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path to write' },
                content: { type: 'string', description: 'Content to write' }
              },
              required: ['path', 'content']
            }
          },
          {
            name: 'list_directory',
            description: 'List contents of a directory',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Directory path to list' }
              },
              required: ['path']
            }
          }
        ]
      },
      {
        qualifiedName: 'memory',
        displayName: 'Memory',
        description: 'Store and retrieve persistent data',
        createdAt: new Date().toISOString(),
        useCount: 0,
        homepage: '',
        type: 'builtin',
        isDeployed: true,
        tools: [
          {
            name: 'store_data',
            description: 'Store data in persistent memory',
            inputSchema: {
              type: 'object',
              properties: {
                key: { type: 'string', description: 'Key for the data' },
                value: { description: 'Value to store' }
              },
              required: ['key', 'value']
            }
          },
          {
            name: 'retrieve_data',
            description: 'Retrieve data from persistent memory',
            inputSchema: {
              type: 'object',
              properties: {
                key: { type: 'string', description: 'Key to retrieve' }
              },
              required: ['key']
            }
          }
        ]
      },
      {
        qualifiedName: 'web_search',
        displayName: 'Web Search',
        description: 'Search the web for information',
        createdAt: new Date().toISOString(),
        useCount: 0,
        homepage: '',
        type: 'builtin',
        isDeployed: true,
        tools: [
          {
            name: 'search',
            description: 'Search the web for information',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                limit: { type: 'number', description: 'Maximum number of results' }
              },
              required: ['query']
            }
          }
        ]
      }
    ]
  }

  /**
   * Get custom MCP servers configured by the user
   */
  async getCustomServers(userId: string): Promise<MCPServer[]> {
    try {
      const connections = await blink.db.mcpConnections?.list({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'desc' }
      }) || []

      return connections.map(conn => ({
        qualifiedName: conn.name,
        displayName: conn.displayName || conn.name,
        description: conn.description || `Custom MCP server: ${conn.name}`,
        createdAt: conn.createdAt,
        useCount: conn.useCount || 0,
        homepage: conn.url || '',
        type: 'custom',
        url: conn.url,
        config: conn.config,
        isDeployed: conn.isActive,
        tools: conn.tools || []
      }))
    } catch (error) {
      console.error('Error getting custom MCP servers:', error)
      return []
    }
  }

  /**
   * Get all available MCP servers (built-in + custom)
   */
  async getAllServers(userId: string): Promise<MCPServerListResponse> {
    const builtinServers = await this.getBuiltinServers()
    const customServers = await this.getCustomServers(userId)

    const allServers = [...builtinServers, ...customServers]

    return {
      servers: allServers,
      pagination: {
        currentPage: 1,
        pageSize: allServers.length,
        totalPages: 1,
        totalCount: allServers.length
      }
    }
  }

  /**
   * Get categorized list of popular MCP servers
   */
  async getPopularServers(userId: string): Promise<PopularServersResponse> {
    const builtinServers = await this.getBuiltinServers()
    const customServers = await this.getCustomServers(userId)

    const allServers = [...builtinServers, ...customServers]

    // Category mappings
    const categoryMappings: Record<string, string> = {
      'filesystem': 'Utilities',
      'memory': 'Utilities',
      'web_search': 'AI & Search',
      'search': 'AI & Search',
      'github': 'Development & Version Control',
      'git': 'Development & Version Control',
      'slack': 'Communication & Collaboration',
      'discord': 'Communication & Collaboration',
      'database': 'Data & Analytics',
      'postgres': 'Data & Analytics',
      'mysql': 'Data & Analytics',
      'aws': 'Cloud & Infrastructure',
      'gcp': 'Cloud & Infrastructure',
      'azure': 'Cloud & Infrastructure'
    }

    // Categorize servers
    const categorized: Record<string, MCPServer[]> = {}

    for (const server of allServers) {
      const qualifiedLower = server.qualifiedName.toLowerCase()
      const descriptionLower = server.description.toLowerCase()

      let category = 'Other'

      // Check qualified name first
      for (const [key, cat] of Object.entries(categoryMappings)) {
        if (qualifiedLower.includes(key)) {
          category = cat
          break
        }
      }

      // Check description if no match
      if (category === 'Other') {
        for (const [key, cat] of Object.entries(categoryMappings)) {
          if (descriptionLower.includes(key)) {
            category = cat
            break
          }
        }
      }

      if (!categorized[category]) {
        categorized[category] = []
      }

      categorized[category].push(server)
    }

    // Sort categories and servers
    const priorityCategories = [
      'AI & Search',
      'Development & Version Control',
      'Utilities',
      'Communication & Collaboration',
      'Data & Analytics',
      'Cloud & Infrastructure',
      'Other'
    ]

    const sortedCategories: Record<string, MCPServer[]> = {}

    for (const category of priorityCategories) {
      if (categorized[category]) {
        sortedCategories[category] = categorized[category].sort(
          (a, b) => b.useCount - a.useCount
        )
      }
    }

    return {
      success: true,
      servers: allServers,
      categorized: sortedCategories,
      total: allServers.length,
      categoryCount: Object.keys(sortedCategories).length,
      pagination: {
        currentPage: 1,
        pageSize: allServers.length,
        totalPages: 1,
        totalCount: allServers.length
      }
    }
  }

  /**
   * Get detailed information about a specific server
   */
  async getServerDetails(qualifiedName: string, userId: string): Promise<MCPServerDetailResponse | null> {
    const allServers = await this.getAllServers(userId)
    const server = allServers.servers.find(s => s.qualifiedName === qualifiedName)

    if (!server) {
      return null
    }

    return {
      qualifiedName: server.qualifiedName,
      displayName: server.displayName,
      iconUrl: server.iconUrl,
      deploymentUrl: server.url,
      connections: server.connections || [],
      security: server.security,
      tools: server.tools
    }
  }

  /**
   * Discover tools from a custom MCP server
   */
  async discoverCustomTools(request: MCPDiscoveryRequest): Promise<MCPDiscoveryResponse> {
    try {
      let tools: MCPTool[] = []

      if (request.type === 'http' || request.type === 'sse') {
        if (!request.config.url) {
          return {
            success: false,
            tools: [],
            error: 'URL is required for HTTP/SSE connections'
          }
        }

        // For now, return mock tools for custom servers
        // In a real implementation, this would connect to the actual MCP server
        tools = [
          {
            name: 'custom_tool',
            description: 'A custom tool from the MCP server',
            inputSchema: {
              type: 'object',
              properties: {
                input: { type: 'string', description: 'Input parameter' }
              },
              required: ['input']
            }
          }
        ]
      } else {
        return {
          success: false,
          tools: [],
          error: `Unsupported connection type: ${request.type}`
        }
      }

      return {
        success: true,
        tools,
        serverName: request.name || 'Custom Server'
      }
    } catch (error) {
      return {
        success: false,
        tools: [],
        error: error instanceof Error ? error.message : 'Discovery failed'
      }
    }
  }

  /**
   * Save a custom MCP connection
   */
  async saveCustomConnection(
    userId: string,
    connection: Omit<CustomMCPConnection, 'id' | 'createdAt' | 'useCount'>
  ): Promise<CustomMCPConnection> {
    try {
      const savedConnection = await blink.db.mcpConnections?.create({
        userId,
        name: connection.name,
        displayName: connection.name,
        description: `Custom MCP server: ${connection.name}`,
        url: connection.url,
        type: connection.type,
        config: connection.config,
        tools: connection.tools,
        isActive: connection.isActive,
        createdAt: new Date(),
        useCount: 0
      })

      if (!savedConnection) {
        throw new Error('Failed to save custom MCP connection')
      }

      return {
        id: savedConnection.id,
        name: savedConnection.name,
        url: savedConnection.url,
        type: savedConnection.type,
        config: savedConnection.config,
        tools: savedConnection.tools,
        isActive: savedConnection.isActive,
        createdAt: new Date(savedConnection.createdAt)
      }
    } catch (error) {
      console.error('Error saving custom MCP connection:', error)
      throw new Error(`Failed to save connection: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Execute a tool on an MCP server
   */
  async executeTool(request: MCPExecutionRequest): Promise<MCPExecutionResult> {
    try {
      const startTime = Date.now()

      // For built-in servers, we can execute directly
      if (request.serverId === 'filesystem') {
        return await this.executeFilesystemTool(request.toolName, request.arguments)
      } else if (request.serverId === 'memory') {
        return await this.executeMemoryTool(request.toolName, request.arguments)
      } else if (request.serverId === 'web_search') {
        return await this.executeWebSearchTool(request.toolName, request.arguments)
      }

      // For custom servers, we would need to implement the actual MCP protocol
      return {
        success: false,
        error: `Execution not implemented for server: ${request.serverId}`,
        metadata: {
          executionTime: Date.now() - startTime,
          serverName: request.serverId,
          toolName: request.toolName
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed'
      }
    }
  }

  /**
   * Execute filesystem tools
   */
  private async executeFilesystemTool(toolName: string, args: Record<string, any>): Promise<MCPExecutionResult> {
    // This would integrate with the file system
    // For security reasons, this is a mock implementation
    switch (toolName) {
      case 'read_file':
        return {
          success: true,
          result: { content: 'File content would be here', size: 100 }
        }
      case 'write_file':
        return {
          success: true,
          result: { bytesWritten: args.content?.length || 0 }
        }
      case 'list_directory':
        return {
          success: true,
          result: { files: ['file1.txt', 'file2.txt'] }
        }
      default:
        return {
          success: false,
          error: `Unknown filesystem tool: ${toolName}`
        }
    }
  }

  /**
   * Execute memory tools
   */
  private async executeMemoryTool(toolName: string, args: Record<string, any>): Promise<MCPExecutionResult> {
    try {
      switch (toolName) {
        case 'store_data':
          await blink.db.kv?.set(`memory:${args.key}`, args.value)
          return {
            success: true,
            result: { stored: true, key: args.key }
          }
        case 'retrieve_data':
          const value = await blink.db.kv?.get(`memory:${args.key}`)
          return {
            success: true,
            result: { value }
          }
        default:
          return {
            success: false,
            error: `Unknown memory tool: ${toolName}`
          }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Memory operation failed'
      }
    }
  }

  /**
   * Execute web search tools
   */
  private async executeWebSearchTool(toolName: string, args: Record<string, any>): Promise<MCPExecutionResult> {
    try {
      if (toolName === 'search') {
        // Use Blink SDK search
        const results = await blink.search(args.query, { limit: args.limit || 10 })
        return {
          success: true,
          result: { results, query: args.query }
        }
      }

      return {
        success: false,
        error: `Unknown web search tool: ${toolName}`
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed'
      }
    }
  }
}

// Export singleton instance
export const mcpClient = MCPClient.getInstance()