/**
 * y0 Analytics API - Reports Endpoint
 * Handle analytics report generation and management
 */

import { NextRequest, NextResponse } from 'next/server'
import { analytics, ReportType, ReportPeriod, AnalyticsReport } from '@/lib/analytics/analytics-engine'

export async function POST(request: NextRequest) {
  try {
    const reportConfig = await request.json()

    // Validate report configuration
    const validatedConfig = validateReportConfig(reportConfig)

    // Generate the report
    const report = await analytics.generateReport(validatedConfig)

    return NextResponse.json({
      success: true,
      report
    })

  } catch (error) {
    console.error('Analytics report generation error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate report',
        success: false
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reportId = searchParams.get('id')
    const type = searchParams.get('type') as ReportType
    const limit = parseInt(searchParams.get('limit') || '10')

    if (reportId) {
      // Get specific report
      const report = await getReportById(reportId)

      if (!report) {
        return NextResponse.json(
          { error: 'Report not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        report
      })
    } else {
      // List reports
      const reports = await listReports(type, limit)

      return NextResponse.json({
        success: true,
        reports,
        total: reports.length
      })
    }

  } catch (error) {
    console.error('Analytics reports API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reportId = searchParams.get('id')

    if (!reportId) {
      return NextResponse.json(
        { error: 'Report ID is required' },
        { status: 400 }
      )
    }

    const updates = await request.json()
    const updatedReport = await updateReport(reportId, updates)

    if (!updatedReport) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      report: updatedReport
    })

  } catch (error) {
    console.error('Analytics report update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reportId = searchParams.get('id')

    if (!reportId) {
      return NextResponse.json(
        { error: 'Report ID is required' },
        { status: 400 }
      )
    }

    const deleted = await deleteReport(reportId)

    if (!deleted) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Report deleted successfully'
    })

  } catch (error) {
    console.error('Analytics report deletion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Validate report configuration
 */
function validateReportConfig(config: any) {
  const errors = []

  // Validate required fields
  if (!config.name || typeof config.name !== 'string') {
    errors.push('Report name is required and must be a string')
  }

  if (!config.type || !Object.values(ReportType).includes(config.type)) {
    errors.push(`Report type must be one of: ${Object.values(ReportType).join(', ')}`)
  }

  if (!config.period || !Object.values(ReportPeriod).includes(config.period)) {
    errors.push(`Report period must be one of: ${Object.values(ReportPeriod).join(', ')}`)
  }

  if (!config.metrics || !Array.isArray(config.metrics) || config.metrics.length === 0) {
    errors.push('Report must have at least one metric')
  }

  // Validate metrics
  if (config.metrics) {
    config.metrics.forEach((metric: any, index: number) => {
      if (!metric.name || typeof metric.name !== 'string') {
        errors.push(`Metric ${index}: name is required and must be a string`)
      }

      if (!metric.type || !['count', 'sum', 'average', 'percentage', 'unique_count'].includes(metric.type)) {
        errors.push(`Metric ${index}: type must be one of: count, sum, average, percentage, unique_count`)
      }
    })
  }

  // Validate filters
  if (config.filters) {
    if (!Array.isArray(config.filters)) {
      errors.push('Filters must be an array')
    } else {
      config.filters.forEach((filter: any, index: number) => {
        if (!filter.field || typeof filter.field !== 'string') {
          errors.push(`Filter ${index}: field is required and must be a string`)
        }

        if (!filter.operator || !['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in'].includes(filter.operator)) {
          errors.push(`Filter ${index}: operator must be one of: eq, ne, gt, gte, lt, lte, in, not_in`)
        }
      })
    }
  }

  // Validate schedule configuration
  if (config.isScheduled && config.scheduleConfig) {
    if (!config.scheduleConfig.frequency || !['daily', 'weekly', 'monthly'].includes(config.scheduleConfig.frequency)) {
      errors.push('Schedule frequency must be one of: daily, weekly, monthly')
    }

    if (!config.scheduleConfig.time || !/^\d{2}:\d{2}$/.test(config.scheduleConfig.time)) {
      errors.push('Schedule time must be in HH:MM format')
    }

    if (!config.scheduleConfig.recipients || !Array.isArray(config.scheduleConfig.recipients)) {
      errors.push('Schedule recipients must be an array of email addresses')
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`)
  }

  return config
}

/**
 * Get report by ID
 */
async function getReportById(reportId: string): Promise<AnalyticsReport | null> {
  try {
    // This would query from the database
    // For now, return null to indicate it needs implementation
    return null
  } catch (error) {
    console.error('Error getting report by ID:', error)
    return null
  }
}

/**
 * List reports
 */
async function listReports(type?: ReportType, limit = 10): Promise<AnalyticsReport[]> {
  try {
    // This would query from the database
    // For now, return empty array
    return []
  } catch (error) {
    console.error('Error listing reports:', error)
    return []
  }
}

/**
 * Update report
 */
async function updateReport(reportId: string, updates: Partial<AnalyticsReport>): Promise<AnalyticsReport | null> {
  try {
    // This would update in the database
    // For now, return null to indicate it needs implementation
    return null
  } catch (error) {
    console.error('Error updating report:', error)
    return null
  }
}

/**
 * Delete report
 */
async function deleteReport(reportId: string): Promise<boolean> {
  try {
    // This would delete from the database
    // For now, return false to indicate it needs implementation
    return false
  } catch (error) {
    console.error('Error deleting report:', error)
    return false
  }
}