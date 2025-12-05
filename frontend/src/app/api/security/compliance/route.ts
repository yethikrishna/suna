/**
 * y0 Security & Compliance API
 * Comprehensive security and compliance management endpoints
 */

import { NextRequest, NextResponse } from 'next/server'
import { complianceManager, SecurityPolicy, ComplianceReport, SecurityAlert } from '@/lib/security/compliance-manager'
import { analytics } from '@/lib/analytics/analytics-engine'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case 'log-audit-event':
        const { auditEvent } = data
        if (!auditEvent) {
          return NextResponse.json(
            { error: 'Audit event data is required' },
            { status: 400 }
          )
        }
        const eventId = await complianceManager.logAuditEvent(auditEvent)
        return NextResponse.json({
          success: true,
          eventId
        })

      case 'create-security-policy':
        const { policy } = data
        if (!policy) {
          return NextResponse.json(
            { error: 'Policy data is required' },
            { status: 400 }
          )
        }
        const createdPolicy = await complianceManager.createSecurityPolicy(policy)
        return NextResponse.json({
          success: true,
          policy: createdPolicy
        })

      case 'create-security-alert':
        const { alert } = data
        if (!alert) {
          return NextResponse.json(
            { error: 'Alert data is required' },
            { status: 400 }
          )
        }
        const createdAlert = await complianceManager.createSecurityAlert(alert)
        return NextResponse.json({
          success: true,
          alert: createdAlert
        })

      case 'evaluate-policies':
        const { context } = data
        if (!context) {
          return NextResponse.json(
            { error: 'Security context is required' },
            { status: 400 }
          )
        }
        const evaluationResult = await complianceManager.evaluateSecurityPolicies(context)
        return NextResponse.json({
          success: true,
          result: evaluationResult
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: log-audit-event, create-security-policy, create-security-alert, evaluate-policies' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('[Security Compliance API] Error:', error)

    // Track security API errors
    analytics.track({
      type: 'security_event' as any,
      category: 'security' as any,
      action: 'api_error',
      resource: '/api/security/compliance',
      outcome: 'failure',
      properties: {
        action: body.action,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })

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
    const action = searchParams.get('action')

    switch (action) {
      case 'security-metrics':
        const periodParam = searchParams.get('period')
        let period = undefined

        if (periodParam) {
          try {
            const periodData = JSON.parse(periodParam)
            period = {
              start: new Date(periodData.start),
              end: new Date(periodData.end)
            }
          } catch (error) {
            return NextResponse.json(
              { error: 'Invalid period format. Use JSON format: {"start": "2024-01-01", "end": "2024-12-31"}' },
              { status: 400 }
            )
          }
        }

        const metrics = await complianceManager.getSecurityMetrics(period)
        return NextResponse.json({
          success: true,
          metrics
        })

      case 'security-policies':
        const policies = await complianceManager.getSecurityPolicies()
        return NextResponse.json({
          success: true,
          policies
        })

      case 'security-alerts':
        const alerts = await complianceManager.getSecurityAlerts()
        return NextResponse.json({
          success: true,
          alerts
        })

      case 'compliance-reports':
        const reports = await complianceManager.getComplianceReports()
        return NextResponse.json({
          success: true,
          reports
        })

      case 'audit-events':
        const limit = parseInt(searchParams.get('limit') || '100')
        const offset = parseInt(searchParams.get('offset') || '0')
        const eventType = searchParams.get('eventType')
        const category = searchParams.get('category')

        const auditEvents = await complianceManager.getAuditEvents({
          limit,
          offset,
          eventType: eventType as any,
          category: category as any
        })
        return NextResponse.json({
          success: true,
          events: auditEvents
        })

      case 'health-check':
        const health = await complianceManager.getHealthStatus()
        return NextResponse.json({
          success: true,
          health
        })

      default:
        // Return overview if no specific action
        const overviewMetrics = await complianceManager.getSecurityMetrics()
        return NextResponse.json({
          success: true,
          overview: overviewMetrics
        })
    }

  } catch (error) {
    console.error('[Security Compliance API] Error:', error)

    // Track security API errors
    analytics.track({
      type: 'security_event' as any,
      category: 'security' as any,
      action: 'api_error',
      resource: '/api/security/compliance',
      outcome: 'failure',
      properties: {
        action: searchParams.get('action') || 'overview',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })

    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const body = await request.json()

    switch (action) {
      case 'resolve-alert':
        const { alertId, resolution } = body
        if (!alertId || !resolution) {
          return NextResponse.json(
            { error: 'Alert ID and resolution are required' },
            { status: 400 }
          )
        }

        const resolvedAlert = await complianceManager.resolveSecurityAlert(alertId, resolution)
        return NextResponse.json({
          success: true,
          alert: resolvedAlert
        })

      case 'update-policy':
        const { policyId, policy } = body
        if (!policyId || !policy) {
          return NextResponse.json(
            { error: 'Policy ID and policy data are required' },
            { status: 400 }
          )
        }

        const updatedPolicy = await complianceManager.updateSecurityPolicy(policyId, policy)
        return NextResponse.json({
          success: true,
          policy: updatedPolicy
        })

      case 'escalate-alert':
        const { alertId: escalateAlertId, escalation } = body
        if (!escalateAlertId || !escalation) {
          return NextResponse.json(
            { error: 'Alert ID and escalation details are required' },
            { status: 400 }
          )
        }

        const escalatedAlert = await complianceManager.escalateSecurityAlert(escalateAlertId, escalation)
        return NextResponse.json({
          success: true,
          alert: escalatedAlert
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: resolve-alert, update-policy, escalate-alert' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('[Security Compliance API] Error:', error)

    // Track security API errors
    analytics.track({
      type: 'security_event' as any,
      category: 'security' as any,
      action: 'api_error',
      resource: '/api/security/compliance',
      outcome: 'failure',
      properties: {
        action: searchParams.get('action'),
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })

    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'delete-policy':
        const policyId = searchParams.get('id')
        if (!policyId) {
          return NextResponse.json(
            { error: 'Policy ID is required' },
            { status: 400 }
          )
        }

        await complianceManager.deleteSecurityPolicy(policyId)
        return NextResponse.json({
          success: true,
          message: 'Security policy deleted successfully'
        })

      case 'delete-alert':
        const alertId = searchParams.get('id')
        if (!alertId) {
          return NextResponse.json(
            { error: 'Alert ID is required' },
            { status: 400 }
          )
        }

        await complianceManager.deleteSecurityAlert(alertId)
        return NextResponse.json({
          success: true,
          message: 'Security alert deleted successfully'
        })

      case 'cleanup-audit-events':
        const retentionDays = parseInt(searchParams.get('retentionDays') || '2555') // Default 7 years
        const deleted = await complianceManager.cleanupAuditEvents(retentionDays)
        return NextResponse.json({
          success: true,
          deletedEvents: deleted,
          message: `Cleaned up ${deleted} audit events older than ${retentionDays} days`
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: delete-policy, delete-alert, cleanup-audit-events' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('[Security Compliance API] Error:', error)

    // Track security API errors
    analytics.track({
      type: 'security_event' as any,
      category: 'security' as any,
      action: 'api_error',
      resource: '/api/security/compliance',
      outcome: 'failure',
      properties: {
        action: searchParams.get('action'),
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })

    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    )
  }
}