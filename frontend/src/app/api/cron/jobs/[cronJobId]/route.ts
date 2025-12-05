/**
 * y0 Individual Cron Job API Routes
 * Update and delete individual cron jobs
 */

import { NextRequest, NextResponse } from 'next/server'
import { blink } from '@/lib/blink/client'
import { cronJobManager } from '@/lib/cron/cron-manager'

export async function PUT(
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
    const body = await request.json()

    // Update cron job
    const response = await cronJobManager.updateCronJob(user.id, cronJobId, body)

    if (!response.success) {
      return NextResponse.json(
        { error: response.error || 'Failed to update cron job' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: response.data
    })

  } catch (error) {
    console.error('Error updating cron job:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update cron job' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    // Delete cron job
    const response = await cronJobManager.deleteCronJob(user.id, cronJobId)

    if (!response.success) {
      return NextResponse.json(
        { error: response.error || 'Failed to delete cron job' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Cron job deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting cron job:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete cron job' },
      { status: 500 }
    )
  }
}