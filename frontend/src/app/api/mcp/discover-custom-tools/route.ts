/**
 * y0 MCP Custom Tools Discovery API Route
 * Discover tools from custom MCP servers
 */

import { NextRequest, NextResponse } from 'next/server'
import { blink } from '@/lib/blink/client'
import { mcpClient } from '@/lib/mcp/client'

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const user = await blink.auth.me()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, config, name } = body

    // Validate request
    if (!type || !config) {
      return NextResponse.json(
        { error: 'Missing required fields: type, config' },
        { status: 400 }
      )
    }

    if (!['http', 'sse', 'stdio'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid connection type. Must be http, sse, or stdio' },
        { status: 400 }
      )
    }

    // Discover tools
    const discoveryResponse = await mcpClient.discoverCustomTools({
      type,
      config,
      name: name || 'Custom Server'
    })

    if (!discoveryResponse.success) {
      return NextResponse.json(
        { error: discoveryResponse.error || 'Tool discovery failed' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      tools: discoveryResponse.tools,
      serverName: discoveryResponse.serverName,
      count: discoveryResponse.tools.length
    })

  } catch (error) {
    console.error('Error discovering custom MCP tools:', error)
    return NextResponse.json(
      { error: 'Failed to discover custom tools' },
      { status: 500 }
    )
  }
}