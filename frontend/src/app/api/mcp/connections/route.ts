/**
 * y0 MCP Connections API Route
 * Manage custom MCP server connections
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

    // Get custom connections
    const connections = await mcpClient.getCustomServers(user.id)

    return NextResponse.json({
      success: true,
      data: connections
    })

  } catch (error) {
    console.error('Error fetching MCP connections:', error)
    return NextResponse.json(
      { error: 'Failed to fetch MCP connections' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const user = await blink.auth.me()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, url, type, config, tools } = body

    // Validate required fields
    if (!name || !url || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: name, url, type' },
        { status: 400 }
      )
    }

    if (!['http', 'sse', 'stdio'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid connection type. Must be http, sse, or stdio' },
        { status: 400 }
      )
    }

    // Save connection
    const connection = await mcpClient.saveCustomConnection(user.id, {
      name,
      url,
      type,
      config: config || {},
      tools: tools || [],
      isActive: true
    })

    return NextResponse.json({
      success: true,
      data: connection
    })

  } catch (error) {
    console.error('Error saving MCP connection:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save MCP connection' },
      { status: 500 }
    )
  }
}