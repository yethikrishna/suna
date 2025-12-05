/**
 * y0 Cron Jobs API Routes
 * Manage cron-job.org integration for scheduled workflows
 */

import { NextRequest, NextResponse } from 'next/server'
import { blink } from '@/lib/blink/client'
import { cronJobManager, CreateCronJobRequest } from '@/lib/cron/cron-manager'

export async function GET(request: NextRequest) {
  try {
    // Get current user
    const user = await blink.auth.me()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')

    // Get cron jobs
    const response = await cronJobManager.listCronJobs(user.id, page, pageSize)

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching cron jobs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cron jobs' },
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
    const cronJobRequest: CreateCronJobRequest = {
      name: body.name,
      description: body.description,
      schedule: body.schedule,
      workflowId: body.workflowId,
      timezone: body.timezone,
      headers: body.headers,
      retryCount: body.retryCount,
      timeout: body.timeout
    }

    // Validate required fields
    if (!cronJobRequest.name || !cronJobRequest.schedule || !cronJobRequest.workflowId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, schedule, workflowId' },
        { status: 400 }
      )
    }

    // Create cron job
    const response = await cronJobManager.createCronJob(user.id, cronJobRequest)

    if (!response.success) {
      return NextResponse.json(
        { error: response.error || 'Failed to create cron job' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: response.data,
      cronJobId: response.cronJobId
    })

  } catch (error) {
    console.error('Error creating cron job:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create cron job' },
      { status: 500 }
    )
  }
}