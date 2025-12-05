/**
 * y0 Manual Cron Job Execution API
 * Manually trigger a cron job for testing
 */

import { NextRequest, NextResponse } from 'next/server'
import { blink } from '@/lib/blink/client'

export async function POST(
  request: NextRequest,
  { params }: { params: { cronJobId: string } }
) {
  try {
    // Get current user
    const user = await blink.auth.me()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { cronJobId } = params

    // Get cron job
    const cronJob = await blink.db.cronJobs?.findById(cronJobId)
    if (!cronJob || cronJob.userId !== user.id) {
      return NextResponse.json(
        { error: 'Cron job not found or access denied' },
        { status: 404 }
      )
    }

    // Get workflow
    const workflow = await blink.db.workflows?.findById(cronJob.workflowId)
    if (!workflow) {
      return NextResponse.json(
        { error: 'Associated workflow not found' },
        { status: 404 }
      )
    }

    console.log(`[Manual Execution] Triggering cron job: ${cronJob.name}`)

    // Trigger workflow execution via webhook
    const webhookUrl = `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/cron/webhook/${workflow.id}`

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'y0-manual-trigger/1.0'
      },
      body: JSON.stringify({
        triggeredBy: 'manual',
        cronJobId: cronJob.id,
        cronJobName: cronJob.name,
        triggeredAt: new Date().toISOString(),
        userId: user.id
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Manual Execution] Failed: ${response.status} ${errorText}`)
      return NextResponse.json(
        {
          error: 'Failed to trigger workflow execution',
          details: errorText,
          status: response.status
        },
        { status: 500 }
      )
    }

    const result = await response.json()

    console.log(`[Manual Execution] Success: ${result.executionId}`)

    // Update cron job stats
    await blink.db.cronJobs?.update(cronJobId, {
      lastRun: new Date(),
      runCount: cronJob.runCount + 1,
      updatedAt: new Date()
    })

    return NextResponse.json({
      success: true,
      message: 'Cron job executed successfully',
      executionId: result.executionId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      cronJobName: cronJob.name,
      triggeredAt: new Date().toISOString(),
      result
    })

  } catch (error) {
    console.error('[Manual Execution] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to execute cron job',
        triggeredAt: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}