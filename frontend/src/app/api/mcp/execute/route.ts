/**
 * y0 MCP Tool Execution API Route
 * Execute tools on MCP servers
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
    const { serverId, toolName, arguments: toolArgs, context } = body

    // Validate required fields
    if (!serverId || !toolName) {
      return NextResponse.json(
        { error: 'Missing required fields: serverId, toolName' },
        { status: 400 }
      )
    }

    // Execute tool
    const result = await mcpClient.executeTool({
      serverId,
      toolName,
      arguments: toolArgs || {},
      context: context || {}
    })

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          metadata: result.metadata
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      result: result.result,
      metadata: result.metadata
    })

  } catch (error) {
    console.error('Error executing MCP tool:', error)
    return NextResponse.json(
      { error: 'Failed to execute MCP tool' },
      { status: 500 }
    )
  }
}