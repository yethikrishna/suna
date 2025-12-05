/**
 * y0 MCP Servers API Route
 * Lists available MCP servers (built-in + custom)
 */

import { NextRequest, NextResponse } from 'next/server'
import { blink } from '@/lib/blink/client'
import { mcpClient } from '@/lib/mcp/client'

export async function GET(request: NextRequest) {
  try {
    // Get current user
    const user = await blink.auth.me()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')

    // Get all servers
    const response = await mcpClient.getAllServers(user.id)

    // Filter servers if search query provided
    let filteredServers = response.servers
    if (q) {
      const searchLower = q.toLowerCase()
      filteredServers = response.servers.filter(server =>
        server.displayName.toLowerCase().includes(searchLower) ||
        server.description.toLowerCase().includes(searchLower) ||
        server.qualifiedName.toLowerCase().includes(searchLower)
      )
    }

    // Apply pagination
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedServers = filteredServers.slice(startIndex, endIndex)

    return NextResponse.json({
      success: true,
      servers: paginatedServers,
      pagination: {
        currentPage: page,
        pageSize,
        totalPages: Math.ceil(filteredServers.length / pageSize),
        totalCount: filteredServers.length
      }
    })

  } catch (error) {
    console.error('Error fetching MCP servers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch MCP servers' },
      { status: 500 }
    )
  }
}