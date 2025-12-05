/**
 * y0 MCP Server Details API Route
 * Get detailed information about a specific MCP server
 */

import { NextRequest, NextResponse } from 'next/server'
import { blink } from '@/lib/blink/client'
import { mcpClient } from '@/lib/mcp/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { qualifiedName: string } }
) {
  try {
    // Get current user
    const user = await blink.auth.me()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { qualifiedName } = params

    // Get server details
    const serverDetails = await mcpClient.getServerDetails(qualifiedName, user.id)

    if (!serverDetails) {
      return NextResponse.json(
        { error: `MCP server '${qualifiedName}' not found` },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: serverDetails
    })

  } catch (error) {
    console.error('Error fetching MCP server details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch MCP server details' },
      { status: 500 }
    )
  }
}