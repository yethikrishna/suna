/**
 * y0 MCP Servers API Route
 * Handles MCP server configuration using Blink SDK
 */

import { NextRequest, NextResponse } from 'next/server'
import { blink } from '@/lib/blink/client'

export async function GET(request: NextRequest) {
  try {
    // Get current user using Blink SDK
    const user = await blink.auth.me()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get MCP servers for current user from Blink database
    const mcpServers = await blink.db.mcpServers?.list({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    }) || []

    return NextResponse.json({
      success: true,
      data: mcpServers
    })

  } catch (error) {
    console.error('Error fetching MCP servers:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch MCP servers'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const user = await blink.auth.me()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { name, url, description, config, isActive } = body

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'MCP server name is required' },
        { status: 400 }
      )
    }

    if (!url) {
      return NextResponse.json(
        { error: 'MCP server URL is required' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid MCP server URL format' },
        { status: 400 }
      )
    }

    // Create MCP server in Blink database
    const mcpServer = await blink.db.mcpServers?.create({
      name,
      url,
      description: description || '',
      config: config || {},
      userId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: isActive !== undefined ? isActive : true,
      status: 'disconnected', // Will be updated by connection test
      lastConnected: null
    })

    if (!mcpServer) {
      throw new Error('Failed to create MCP server')
    }

    return NextResponse.json({
      success: true,
      data: mcpServer
    })

  } catch (error) {
    console.error('Error creating MCP server:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create MCP server'
      },
      { status: 500 }
    )
  }
}