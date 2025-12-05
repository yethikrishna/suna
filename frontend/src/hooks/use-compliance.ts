/**
 * y0 Security & Compliance React Hooks
 * React hooks for security and compliance management
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  complianceManager,
  SecurityPolicy,
  ComplianceReport,
  SecurityAlert,
  SecurityMetrics,
  AuditEvent,
  ComplianceStandard,
  SecurityAlertType
} from '@/lib/security/compliance-manager'

/**
 * Hook for compliance manager functionality
 */
export function useComplianceManager() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true)
      try {
        await complianceManager.initialize()
        setIsInitialized(true)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to initialize compliance manager'))
      } finally {
        setIsLoading(false)
      }
    }

    initialize()
  }, [])

  const logAuditEvent = useCallback(async (event: Omit<AuditEvent, 'id' | 'timestamp' | 'riskScore'>) => {
    try {
      return await complianceManager.logAuditEvent(event)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to log audit event'))
      throw err
    }
  }, [])

  const createSecurityPolicy = useCallback(async (policy: Omit<SecurityPolicy, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      return await complianceManager.createSecurityPolicy(policy)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create security policy'))
      throw err
    }
  }, [])

  const generateComplianceReport = useCallback(async (
    standard: ComplianceStandard,
    period: { start: Date; end: Date }
  ) => {
    try {
      return await complianceManager.generateComplianceReport(standard, period)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to generate compliance report'))
      throw err
    }
  }, [])

  const createSecurityAlert = useCallback(async (alert: Omit<SecurityAlert, 'id' | 'timestamp' | 'status'>) => {
    try {
      return await complianceManager.createSecurityAlert(alert)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create security alert'))
      throw err
    }
  }, [])

  return {
    isInitialized,
    isLoading,
    error,
    logAuditEvent,
    createSecurityPolicy,
    generateComplianceReport,
    createSecurityAlert
  }
}

/**
 * Hook for security metrics
 */
export function useSecurityMetrics(period?: { start: Date; end: Date }, refreshInterval = 60000) {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchMetrics = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await complianceManager.getSecurityMetrics(period)
      setMetrics(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch security metrics'))
    } finally {
      setIsLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchMetrics()

    const interval = setInterval(fetchMetrics, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchMetrics, refreshInterval])

  return {
    metrics,
    isLoading,
    error,
    refetch: fetchMetrics
  }
}

/**
 * Hook for compliance reports
 */
export function useComplianceReports() {
  const [reports, setReports] = useState<ComplianceReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const { logAuditEvent } = useComplianceManager()

  const generateReport = useCallback(async (standard: ComplianceStandard, period?: { start: Date; end: Date }) => {
    try {
      const defaultPeriod = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      }

      const reportPeriod = period || defaultPeriod
      const report = await complianceManager.generateComplianceReport(standard, reportPeriod)

      setReports(prev => [...prev, report])

      // Log report generation
      await logAuditEvent({
        eventType: 'compliance_event' as any,
        category: 'compliance' as any,
        action: 'compliance_report_generated',
        resource: `report:${report.id}`,
        outcome: 'success',
        details: {
          standard,
          score: report.score,
          findingsCount: report.findings.length
        }
      })

      return report
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to generate compliance report'))
      throw err
    }
  }, [logAuditEvent])

  useEffect(() => {
    // Load existing reports would go here
    setIsLoading(false)
  }, [])

  return {
    reports,
    isLoading,
    error,
    generateReport
  }
}

/**
 * Hook for security alerts
 */
export function useSecurityAlerts() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const { createSecurityAlert, logAuditEvent } = useComplianceManager()

  const createAlert = useCallback(async (alert: Omit<SecurityAlert, 'id' | 'timestamp' | 'status'>) => {
    try {
      const newAlert = await createSecurityAlert(alert)
      setAlerts(prev => [newAlert, ...prev])

      // Log alert creation
      await logAuditEvent({
        eventType: 'security_event' as any,
        category: 'security' as any,
        action: 'security_alert_created',
        resource: `alert:${newAlert.id}`,
        outcome: 'success',
        details: {
          alertType: alert.type,
          severity: alert.severity,
          title: alert.title
        }
      })

      return newAlert
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create security alert'))
      throw err
    }
  }, [createSecurityAlert, logAuditEvent])

  const resolveAlert = useCallback(async (alertId: string, resolution: { action: string; notes: string }) => {
    try {
      // This would update the alert in the backend
      setAlerts(prev => prev.map(alert =>
        alert.id === alertId
          ? {
              ...alert,
              status: 'resolved' as const,
              resolution: {
                ...resolution,
                timestamp: new Date(),
                resolvedBy: 'current_user' // Would get from auth context
              }
            }
          : alert
      ))

      // Log alert resolution
      await logAuditEvent({
        eventType: 'security_event' as any,
        category: 'security' as any,
        action: 'security_alert_resolved',
        resource: `alert:${alertId}`,
        outcome: 'success',
        details: {
          resolutionAction: resolution.action,
          resolutionNotes: resolution.notes
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to resolve security alert'))
      throw err
    }
  }, [logAuditEvent])

  useEffect(() => {
    // Load existing alerts would go here
    setIsLoading(false)
  }, [])

  return {
    alerts,
    isLoading,
    error,
    createAlert,
    resolveAlert
  }
}

/**
 * Hook for audit logging
 */
export function useAuditLogging() {
  const { logAuditEvent } = useComplianceManager()

  const logUserAction = useCallback(async (
    action: string,
    resource: string,
    outcome: 'success' | 'failure' | 'partial',
    details: Record<string, any> = {}
  ) => {
    await logAuditEvent({
      eventType: 'user_action' as any,
      category: 'audit' as any,
      action,
      resource,
      outcome,
      details
    })
  }, [logAuditEvent])

  const logAuthentication = useCallback(async (
    action: 'login' | 'logout' | 'signup' | 'mfa_challenge',
    outcome: 'success' | 'failure',
    userId?: string,
    details: Record<string, any> = {}
  ) => {
    await logAuditEvent({
      eventType: 'authentication_event' as any,
      category: 'authentication' as any,
      action,
      resource: 'auth_system',
      outcome,
      userId,
      details
    })
  }, [logAuditEvent])

  const logDataAccess = useCallback(async (
    action: string,
    resource: string,
    dataType: string,
    outcome: 'success' | 'failure' | 'partial',
    details: Record<string, any> = {}
  ) => {
    await logAuditEvent({
      eventType: 'data_access' as any,
      category: 'data_access' as any,
      action,
      resource,
      outcome,
      details: {
        dataType,
        ...details
      }
    })
  }, [logAuditEvent])

  const logSecurityEvent = useCallback(async (
    action: string,
    resource: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    outcome: 'success' | 'failure' | 'partial',
    details: Record<string, any> = {}
  ) => {
    await logAuditEvent({
      eventType: 'security_event' as any,
      category: 'security' as any,
      action,
      resource,
      outcome,
      details: {
        severity,
        ...details
      }
    })
  }, [logAuditEvent])

  return {
    logUserAction,
    logAuthentication,
    logDataAccess,
    logSecurityEvent
  }
}

/**
 * Hook for real-time security monitoring
 */
export function useSecurityMonitoring() {
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [threatLevel, setThreatLevel] = useState<'low' | 'medium' | 'high' | 'critical'>('low')
  const [recentAlerts, setRecentAlerts] = useState<SecurityAlert[]>([])

  const { metrics, refetch: refetchMetrics } = useSecurityMetrics(undefined, 30000) // 30 second refresh
  const { createAlert } = useSecurityAlerts()
  const { logSecurityEvent } = useAuditLogging()

  const startMonitoring = useCallback(() => {
    setIsMonitoring(true)
    console.log('[Security Monitoring] Started')
  }, [])

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false)
    console.log('[Security Monitoring] Stopped')
  }, [])

  const detectAnomaly = useCallback(async (description: string, details: Record<string, any>) => {
    await createAlert({
      type: SecurityAlertType.ANOMALOUS_BEHAVIOR,
      severity: 'medium',
      title: 'Anomalous Activity Detected',
      description,
      source: 'monitoring_system',
      details
    })

    await logSecurityEvent(
      'anomaly_detected',
      'monitoring_system',
      'medium',
      'success',
      { description, ...details }
    )
  }, [createAlert, logSecurityEvent])

  // Update threat level based on metrics
  useEffect(() => {
    if (!metrics) return

    let newThreatLevel: typeof threatLevel = 'low'

    if (metrics.criticalAlerts > 0) {
      newThreatLevel = 'critical'
    } else if (metrics.highRiskEvents > 10 || metrics.openAlerts > 5) {
      newThreatLevel = 'high'
    } else if (metrics.failedAuthentications > 20 || metrics.averageRiskScore > 60) {
      newThreatLevel = 'medium'
    }

    if (newThreatLevel !== threatLevel) {
      setThreatLevel(newThreatLevel)
      console.log(`[Security Monitoring] Threat level changed to: ${newThreatLevel}`)
    }
  }, [metrics, threatLevel])

  return {
    isMonitoring,
    threatLevel,
    recentAlerts,
    metrics,
    startMonitoring,
    stopMonitoring,
    detectAnomaly,
    refetchMetrics
  }
}

/**
 * Hook for compliance assessment
 */
export function useComplianceAssessment() {
  const [isAssessing, setIsAssessing] = useState(false)
  const [lastAssessment, setLastAssessment] = useState<ComplianceReport | null>(null)
  const [assessmentHistory, setAssessmentHistory] = useState<ComplianceReport[]>([])

  const { generateReport } = useComplianceReports()
  const { logUserAction } = useAuditLogging()

  const runAssessment = useCallback(async (
    standard: ComplianceStandard,
    period?: { start: Date; end: Date }
  ) => {
    setIsAssessing(true)
    try {
      const report = await generateReport(standard, period)
      setLastAssessment(report)
      setAssessmentHistory(prev => [report, ...prev])

      await logUserAction(
        'compliance_assessment',
        `standard:${standard}`,
        'success',
        {
          reportId: report.id,
          score: report.score,
          findingsCount: report.findings.length
        }
      )

      return report
    } catch (err) {
      await logUserAction(
        'compliance_assessment',
        `standard:${standard}`,
        'failure',
        { error: err instanceof Error ? err.message : 'Unknown error' }
      )
      throw err
    } finally {
      setIsAssessing(false)
    }
  }, [generateReport, logUserAction])

  return {
    isAssessing,
    lastAssessment,
    assessmentHistory,
    runAssessment
  }
}

/**
 * Hook for security policies management
 */
export function useSecurityPolicies() {
  const [policies, setPolicies] = useState<SecurityPolicy[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const { createSecurityPolicy, logUserAction } = useComplianceManager()

  const createPolicy = useCallback(async (policy: Omit<SecurityPolicy, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newPolicy = await createSecurityPolicy(policy)
      setPolicies(prev => [...prev, newPolicy])

      await logUserAction(
        'security_policy_created',
        `policy:${newPolicy.id}`,
        'success',
        {
          policyName: newPolicy.name,
          policyType: newPolicy.type,
          enabled: newPolicy.enabled
        }
      )

      return newPolicy
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create security policy'))
      throw err
    }
  }, [createSecurityPolicy, logUserAction])

  const togglePolicy = useCallback(async (policyId: string, enabled: boolean) => {
    try {
      // This would update the policy in the backend
      setPolicies(prev => prev.map(policy =>
        policy.id === policyId ? { ...policy, enabled, updatedAt: new Date() } : policy
      ))

      await logUserAction(
        'security_policy_updated',
        `policy:${policyId}`,
        'success',
        {
          enabled,
          action: 'toggle'
        }
      )
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to toggle security policy'))
      throw err
    }
  }, [logUserAction])

  useEffect(() => {
    // Load existing policies would go here
    setIsLoading(false)
  }, [])

  return {
    policies,
    isLoading,
    error,
    createPolicy,
    togglePolicy
  }
}