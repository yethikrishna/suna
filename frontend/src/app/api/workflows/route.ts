/**
 * y0 Workflows API Route
 * Handles workflow CRUD operations using Blink SDK
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

    // Get workflows for current user from Blink database
    const workflows = await blink.db.workflows?.list({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    }) || []

    return NextResponse.json({
      success: true,
      data: workflows
    })

  } catch (error) {
    console.error('Error fetching workflows:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch workflows'
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
    const { name, description, steps, triggers, isActive } = body

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Workflow name is required' },
        { status: 400 }
      )
    }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { error: 'Workflow steps are required' },
        { status: 400 }
      )
    }

    // Create workflow in Blink database
    const workflow = await blink.db.workflows?.create({
      name,
      description: description || '',
      steps: steps || [],
      triggers: triggers || [],
      userId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: isActive !== undefined ? isActive : true,
      lastRun: null,
      runCount: 0
    })

    if (!workflow) {
      throw new Error('Failed to create workflow')
    }

    return NextResponse.json({
      success: true,
      data: workflow
    })

  } catch (error) {
    console.error('Error creating workflow:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create workflow'
      },
      { status: 500 }
    )
  }
}