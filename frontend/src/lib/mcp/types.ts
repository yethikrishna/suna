/**
 * y0 MCP (Model Context Protocol) Types
 * TypeScript interfaces for MCP server management without Smithery
 */

export interface MCPServer {
  qualifiedName: string
  displayName: string
  description: string
  createdAt: string
  useCount: number
  homepage: string
  iconUrl?: string
  isDeployed?: boolean
  connections?: Record<string, any>[]
  tools?: MCPTool[]
  security?: Record<string, any>
  type: 'smithery' | 'custom' | 'builtin'
  url?: string
  config?: Record<string, any>
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, any>
}

export interface MCPServerListResponse {
  servers: MCPServer[]
  pagination: {
    currentPage: number
    pageSize: number
    totalPages: number
    totalCount: number
  }
}

export interface MCPServerDetailResponse {
  qualifiedName: string
  displayName: string
  iconUrl?: string
  deploymentUrl?: string
  connections: Record<string, any>[]
  security?: Record<string, any>
  tools?: MCPTool[]
}

export interface PopularServersResponse {
  success: boolean
  servers: MCPServer[]
  categorized: Record<string, MCPServer[]>
  total: number
  categoryCount: number
  pagination: {
    currentPage: number
    pageSize: number
    totalPages: number
    totalCount: number
  }
}

export interface CustomMCPConnection {
  id: string
  name: string
  url: string
  type: 'http' | 'sse' | 'stdio'
  config: Record<string, any>
  tools: MCPTool[]
  isActive: boolean
  createdAt: Date
  lastConnected?: Date
}

export interface MCPExecutionRequest {
  serverId: string
  toolName: string
  arguments: Record<string, any>
  context?: Record<string, any>
}

export interface MCPExecutionResult {
  success: boolean
  result?: any
  error?: string
  metadata?: {
    executionTime: number
    serverName: string
    toolName: string
  }
}

export interface MCPServerConfiguration {
  qualifiedName: string
  displayName: string
  type: 'smithery' | 'custom' | 'builtin'
  url?: string
  config?: Record<string, any>
  credentials?: Record<string, any>
  isActive: boolean
}

export type MCPConnectionType = 'http' | 'sse' | 'stdio'

export interface MCPDiscoveryRequest {
  type: MCPConnectionType
  config: Record<string, any>
  name?: string
}

export interface MCPDiscoveryResponse {
  success: boolean
  tools: MCPTool[]
  serverName?: string
  error?: string
}