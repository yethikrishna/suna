/**
 * y0 Analytics API - Events Endpoint
 * Handle analytics event tracking and querying
 */

import { NextRequest, NextResponse } from 'next/server'
import { analytics, AnalyticsEvent, EventType, EventCategory } from '@/lib/analytics/analytics-engine'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { events, batch } = body

    // Validate events array
    if (!Array.isArray(events)) {
      return NextResponse.json(
        { error: 'Events must be an array' },
        { status: 400 }
      )
    }

    const results = []

    // Process each event
    for (const eventData of events) {
      try {
        // Validate event structure
        const validatedEvent = validateEvent(eventData)

        // Track the event
        analytics.track(validatedEvent)

        results.push({
          success: true,
          eventId: validatedEvent.id
        })
      } catch (error) {
        console.error('Error processing event:', error)
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Flush events immediately if not batch mode
    if (!batch) {
      await analytics.flush()
    }

    return NextResponse.json({
      success: true,
      processed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    })

  } catch (error) {
    console.error('Analytics events API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const filters = parseFilters(searchParams)
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const eventType = searchParams.get('type') as EventType
    const category = searchParams.get('category') as EventCategory
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build analytics query
    const query = {
      timeRange: {
        start: startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date()
      },
      metrics: [{ name: 'count', type: 'count' as const }],
      filters: [
        ...(eventType ? [{ field: 'type', operator: 'eq' as const, value: eventType }] : []),
        ...(category ? [{ field: 'category', operator: 'eq' as const, value: category }] : []),
        ...filters
      ]
    }

    // Get analytics data
    const data = await analytics.getAnalyticsData(query)

    // Get real-time metrics
    const realTimeMetrics = await analytics.getRealTimeMetrics()

    return NextResponse.json({
      success: true,
      data,
      realTimeMetrics,
      query: {
        limit,
        offset,
        eventType,
        category,
        startDate,
        endDate,
        filters: filters.length
      }
    })

  } catch (error) {
    console.error('Analytics query API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Validate and normalize event data
 */
function validateEvent(eventData: any): Omit<AnalyticsEvent, 'timestamp'> {
  // Required fields
  if (!eventData.type) {
    throw new Error('Event type is required')
  }

  if (!eventData.category) {
    throw new Error('Event category is required')
  }

  if (!eventData.action) {
    throw new Error('Event action is required')
  }

  // Validate event type
  if (!Object.values(EventType).includes(eventData.type)) {
    throw new Error(`Invalid event type: ${eventData.type}`)
  }

  // Validate event category
  if (!Object.values(EventCategory).includes(eventData.category)) {
    throw new Error(`Invalid event category: ${eventData.category}`)
  }

  // Validate value if provided
  if (eventData.value !== undefined && typeof eventData.value !== 'number') {
    throw new Error('Event value must be a number')
  }

  return {
    type: eventData.type,
    category: eventData.category,
    action: eventData.action,
    userId: eventData.userId,
    sessionId: eventData.sessionId,
    properties: eventData.properties || {},
    value: eventData.value,
    metadata: eventData.metadata || {}
  }
}

/**
 * Parse filter parameters from URL
 */
function parseFilters(searchParams: URLSearchParams) {
  const filters = []

  // Parse multiple filters (e.g., filters[0][field]=type&filters[0][operator]=eq&filters[0][value]=page_view)
  for (let i = 0; ; i++) {
    const field = searchParams.get(`filters[${i}][field]`)
    const operator = searchParams.get(`filters[${i}][operator]`)
    const value = searchParams.get(`filters[${i}][value]`)

    if (!field || !operator || value === null) {
      break
    }

    // Parse JSON value if it looks like JSON
    let parsedValue: any = value
    try {
      if (value.startsWith('[') || value.startsWith('{')) {
        parsedValue = JSON.parse(value)
      } else if (value === 'true' || value === 'false') {
        parsedValue = value === 'true'
      } else if (!isNaN(Number(value))) {
        parsedValue = Number(value)
      }
    } catch {
      // Keep as string if parsing fails
    }

    filters.push({
      field,
      operator,
      value: parsedValue
    })
  }

  return filters
}