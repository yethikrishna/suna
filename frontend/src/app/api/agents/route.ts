/**
 * y0 Agents API Route
 * Handles agent CRUD operations using Blink SDK
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

    // Get agents for current user from Blink database
    const agents = await blink.db.agents?.list({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    }) || []

    return NextResponse.json({
      success: true,
      data: agents
    })

  } catch (error) {
    console.error('Error fetching agents:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch agents'
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
    const { name, description, config, tools } = body

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Agent name is required' },
        { status: 400 }
      )
    }

    // Create agent in Blink database
    const agent = await blink.db.agents?.create({
      name,
      description: description || '',
      config: config || {},
      tools: tools || [],
      userId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    })

    if (!agent) {
      throw new Error('Failed to create agent')
    }

    return NextResponse.json({
      success: true,
      data: agent
    })

  } catch (error) {
    console.error('Error creating agent:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create agent'
      },
      { status: 500 }
    )
  }
}