/**
 * y0 AI Workflow Optimizer API
 * AI-powered workflow optimization endpoints
 */

import { NextRequest, NextResponse } from 'next/server'
import { workflowOptimizer } from '@/lib/ai/workflow-optimizer'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, workflowId, recommendationId, config } = body

    switch (action) {
      case 'analyze':
        if (!workflowId) {
          return NextResponse.json(
            { error: 'Workflow ID is required for analysis' },
            { status: 400 }
          )
        }
        const metrics = await workflowOptimizer.analyzeWorkflow(workflowId)
        return NextResponse.json({
          success: true,
          metrics
        })

      case 'recommend':
        if (!workflowId) {
          return NextResponse.json(
            { error: 'Workflow ID is required for recommendations' },
            { status: 400 }
          )
        }
        const recommendations = await workflowOptimizer.generateRecommendations(workflowId)
        return NextResponse.json({
          success: true,
          recommendations
        })

      case 'apply':
        if (!recommendationId) {
          return NextResponse.json(
            { error: 'Recommendation ID is required for application' },
            { status: 400 }
          )
        }
        const autoApply = body.autoApply || false
        const applied = await workflowOptimizer.applyRecommendation(recommendationId, autoApply)
        return NextResponse.json({
          success: true,
          applied
        })

      case 'configure':
        if (!config) {
          return NextResponse.json(
            { error: 'Configuration is required' },
            { status: 400 }
          )
        }
        await workflowOptimizer.configure(config)
        return NextResponse.json({
          success: true,
          message: 'Configuration updated'
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: analyze, recommend, apply, configure' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('[WorkflowOptimizer] API error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        success: false
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workflowIds = searchParams.get('workflowIds')?.split(',') || undefined
    const action = searchParams.get('action')

    switch (action) {
      case 'insights':
        const insights = await workflowOptimizer.getOptimizationInsights(workflowIds)
        return NextResponse.json({
          success: true,
          insights
        })

      case 'recommendations':
        const recommendations = await workflowOptimizer.getRecommendations(workflowIds)
        return NextResponse.json({
          success: true,
          recommendations
        })

      case 'health':
        const health = await workflowOptimizer.getHealth()
        return NextResponse.json({
          success: true,
          health
        })

      default:
        // Default to insights if no action specified
        const defaultInsights = await workflowOptimizer.getOptimizationInsights(workflowIds)
        return NextResponse.json({
          success: true,
          insights: defaultInsights
        })
    }

  } catch (error) {
    console.error('[WorkflowOptimizer] API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const recommendationId = searchParams.get('id')

    if (!recommendationId) {
      return NextResponse.json(
        { error: 'Recommendation ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'approve':
        await workflowOptimizer.approveRecommendation(recommendationId)
        return NextResponse.json({
          success: true,
          message: 'Recommendation approved'
        })

      case 'reject':
        const reason = body.reason
        await workflowOptimizer.rejectRecommendation(recommendationId, reason)
        return NextResponse.json({
          success: true,
          message: 'Recommendation rejected'
        })

      case 'defer':
        const deferUntil = body.deferUntil
        await workflowOptimizer.deferRecommendation(recommendationId, deferUntil)
        return NextResponse.json({
          success: true,
          message: 'Recommendation deferred'
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: approve, reject, defer' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('[WorkflowOptimizer] API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const recommendationId = searchParams.get('id')

    if (!recommendationId) {
      return NextResponse.json(
        { error: 'Recommendation ID is required' },
        { status: 400 }
      )
    }

    await workflowOptimizer.deleteRecommendation(recommendationId)

    return NextResponse.json({
      success: true,
      message: 'Recommendation deleted successfully'
    })

  } catch (error) {
    console.error('[WorkflowOptimizer] API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    )
  }
}