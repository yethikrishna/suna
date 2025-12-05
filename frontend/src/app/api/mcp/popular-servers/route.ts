/**
 * y0 Popular MCP Servers API Route
 * Get categorized list of popular MCP servers
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
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '100')

    // Get popular servers
    const popularResponse = await mcpClient.getPopularServers(user.id)

    return NextResponse.json(popularResponse)

  } catch (error) {
    console.error('Error fetching popular MCP servers:', error)
    return NextResponse.json(
      {
        success: false,
        servers: [],
        categorized: {},
        total: 0,
        categoryCount: 0,
        pagination: { currentPage: 1, pageSize: 100, totalPages: 0, totalCount: 0 }
      },
      { status: 500 }
    )
  }
}