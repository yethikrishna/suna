/**
 * y0 MCP (Model Context Protocol) Module
 * Complete MCP system without Smithery dependency
 */

// Export types
export * from './types'

// Export client and manager
export { mcpClient, MCPClient } from './client'

// Export tool schemas for AI integration
export const mcpToolSchemas = {
  // Built-in filesystem tools
  read_file: {
    type: 'function',
    function: {
      name: 'mcp_read_file',
      description: 'Read the contents of a file from the filesystem',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to read'
          }
        },
        required: ['path']
      }
    }
  },

  write_file: {
    type: 'function',
    function: {
      name: 'mcp_write_file',
      description: 'Write content to a file on the filesystem',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to write'
          },
          content: {
            type: 'string',
            description: 'Content to write to the file'
          }
        },
        required: ['path', 'content']
      }
    }
  },

  list_directory: {
    type: 'function',
    function: {
      name: 'mcp_list_directory',
      description: 'List contents of a directory',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory path to list'
          }
        },
        required: ['path']
      }
    }
  },

  // Memory tools
  store_data: {
    type: 'function',
    function: {
      name: 'mcp_store_data',
      description: 'Store data in persistent memory',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'Key for the data'
          },
          value: {
            description: 'Value to store (any JSON-serializable data)'
          }
        },
        required: ['key', 'value']
      }
    }
  },

  retrieve_data: {
    type: 'function',
    function: {
      name: 'mcp_retrieve_data',
      description: 'Retrieve data from persistent memory',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'Key to retrieve'
          }
        },
        required: ['key']
      }
    }
  },

  // Web search tools
  search_web: {
    type: 'function',
    function: {
      name: 'mcp_search_web',
      description: 'Search the web for information using built-in search',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return',
            default: 10
          }
        },
        required: ['query']
      }
    }
  }
}

/**
 * Get all available MCP tool schemas
 */
export function getAllMcpToolSchemas() {
  return mcpToolSchemas
}

/**
 * Get built-in MCP server names
 */
export function getBuiltinServerNames() {
  return ['filesystem', 'memory', 'web_search']
}

/**
 * Helper function to execute MCP tools
 */
export async function executeMcpTool(serverId: string, toolName: string, args: Record<string, any>) {
  return await mcpClient.executeTool({
    serverId,
    toolName,
    arguments: args
  })
}