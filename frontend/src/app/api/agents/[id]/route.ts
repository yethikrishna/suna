/**
 * y0 Individual Agent API Route
 * Handles individual agent operations using Blink SDK
 */

import { NextRequest, NextResponse } from 'next/server'
import { blink } from '@/lib/blink/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get current user
    const user = await blink.auth.me()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const agentId = params.id

    // Get specific agent
    const agent = await blink.db.agents?.list({
      where: {
        id: agentId,
        userId: user.id
      }
    })

    if (!agent || agent.length === 0) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: agent[0]
    })

  } catch (error) {
    console.error('Error fetching agent:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch agent'
      },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get current user
    const user = await blink.auth.me()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const agentId = params.id

    // Parse request body
    const body = await request.json()
    const { name, description, config, tools, isActive } = body

    // Update agent
    const updatedAgent = await blink.db.agents?.update(agentId, {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(config && { config }),
      ...(tools && { tools }),
      ...(isActive !== undefined && { isActive }),
      updatedAt: new Date()
    })

    if (!updatedAgent) {
      // Check if agent exists
      const existingAgent = await blink.db.agents?.list({
        where: { id: agentId, userId: user.id }
      })

      if (!existingAgent || existingAgent.length === 0) {
        return NextResponse.json(
          { error: 'Agent not found' },
          { status: 404 }
        )
      }

      throw new Error('Failed to update agent')
    }

    return NextResponse.json({
      success: true,
      data: updatedAgent
    })

  } catch (error) {
    console.error('Error updating agent:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update agent'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get current user
    const user = await blink.auth.me()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const agentId = params.id

    // Verify agent belongs to user
    const existingAgent = await blink.db.agents?.list({
      where: { id: agentId, userId: user.id }
    })

    if (!existingAgent || existingAgent.length === 0) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Delete agent
    await blink.db.agents?.delete(agentId)

    return NextResponse.json({
      success: true,
      message: 'Agent deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting agent:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete agent'
      },
      { status: 500 }
    )
  }
}