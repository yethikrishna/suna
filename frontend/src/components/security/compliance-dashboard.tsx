/**
 * y0 Security & Compliance Dashboard
 * Comprehensive security monitoring and compliance management dashboard
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area
} from 'recharts'
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Users,
  Activity,
  FileText,
  Lock,
  Eye,
  Settings,
  RefreshCw,
  Download,
  AlertCircle,
  ShieldCheck,
  Database,
  Key,
  UserCheck,
  Policy,
  Gavel
} from 'lucide-react'
import {
  useSecurityMetrics,
  useSecurityAlerts,
  useComplianceReports,
  useSecurityMonitoring,
  useComplianceAssessment,
  useSecurityPolicies
} from '@/hooks/use-compliance'
import { ComplianceStandard, SecurityAlertType } from '@/lib/security/compliance-manager'

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#ff0000', '#00cccc', '#ff00ff']

export default function ComplianceDashboard() {
  const { metrics, isLoading: metricsLoading } = useSecurityMetrics()
  const { alerts, createAlert, resolveAlert } = useSecurityAlerts()
  const { reports, generateReport } = useComplianceReports()
  const { isMonitoring, threatLevel, startMonitoring, stopMonitoring } = useSecurityMonitoring()
  const { isAssessing, lastAssessment, runAssessment } = useComplianceAssessment()
  const { policies, createPolicy, togglePolicy } = useSecurityPolicies()

  // Generate mock time-series data for charts
  const securityTrendsData = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
    events: Math.floor(Math.random() * 100) + 50,
    alerts: Math.floor(Math.random() * 10) + 2,
    riskScore: Math.floor(Math.random() * 40) + 30
  }))

  const riskDistributionData = [
    { name: 'Low', value: 45, color: '#22c55e' },
    { name: 'Medium', value: 30, color: '#eab308' },
    { name: 'High', value: 20, color: '#f97316' },
    { name: 'Critical', value: 5, color: '#ef4444' }
  ]

  const complianceScores = [
    { standard: 'GDPR', score: 92, fullMark: 100 },
    { standard: 'SOC 2', score: 88, fullMark: 100 },
    { standard: 'ISO 27001', score: 85, fullMark: 100 },
    { standard: 'NIST', score: 90, fullMark: 100 }
  ]

  const handleGenerateComplianceReport = async (standard: ComplianceStandard) => {
    try {
      await generateReport(standard)
    } catch (error) {
      console.error('Failed to generate compliance report:', error)
    }
  }

  const getThreatLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getAlertTypeIcon = (type: SecurityAlertType) => {
    switch (type) {
      case SecurityAlertType.UNAUTHORIZED_ACCESS:
        return <UserCheck className="h-4 w-4" />
      case SecurityAlertType.SUSPICIOUS_ACTIVITY:
        return <AlertTriangle className="h-4 w-4" />
      case SecurityAlertType.DATA_BREACH:
        return <Database className="h-4 w-4" />
      case SecurityAlertType.POLICY_VIOLATION:
        return <Gavel className="h-4 w-4" />
      default:
        return <Shield className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8 text-blue-600" />
            Security & Compliance
          </h1>
          <p className="text-muted-foreground">
            Comprehensive security monitoring and compliance management
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge className={getThreatLevelColor(threatLevel)}>
            Threat Level: {threatLevel.toUpperCase()}
          </Badge>
          <Button
            variant={isMonitoring ? "default" : "outline"}
            size="sm"
            onClick={isMonitoring ? stopMonitoring : startMonitoring}
            className="flex items-center gap-2"
          >
            {isMonitoring ? <Eye className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
            Monitoring: {isMonitoring ? 'On' : 'Off'}
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Security Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.securityEvents || 0}</div>
            <p className="text-xs text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.openAlerts || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active security alerts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Risk Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(metrics?.averageRiskScore || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Overall risk assessment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(metrics?.complianceScore || 0)}%</div>
            <p className="text-xs text-muted-foreground">
              Overall compliance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="alerts">Security Alerts</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="policies">Security Policies</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Security Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Security Trends</CardTitle>
                <CardDescription>
                  Security events and alerts over the last 30 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={securityTrendsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="events"
                      stackId="1"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.3}
                      name="Events"
                    />
                    <Area
                      type="monotone"
                      dataKey="alerts"
                      stackId="2"
                      stroke="#ff7300"
                      fill="#ff7300"
                      fillOpacity={0.3}
                      name="Alerts"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Risk Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Risk Distribution</CardTitle>
                <CardDescription>
                  Distribution of security risk levels
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={riskDistributionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {riskDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Compliance Scores */}
          <Card>
            <CardHeader>
              <CardTitle>Compliance Scores</CardTitle>
              <CardDescription>
                Current compliance status across major standards
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={complianceScores}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="standard" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar
                    name="Compliance Score"
                    dataKey="score"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.3}
                  />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Security Alerts</h3>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>

          <div className="grid gap-4">
            {alerts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <ShieldCheck className="h-12 w-12 text-green-600 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Security Alerts</h3>
                  <p className="text-muted-foreground text-center">
                    All systems are operating normally. No security alerts have been detected.
                  </p>
                </CardContent>
              </Card>
            ) : (
              alerts.map((alert) => (
                <Card key={alert.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getAlertTypeIcon(alert.type)}
                        <div>
                          <CardTitle className="text-base">{alert.title}</CardTitle>
                          <CardDescription>
                            {alert.timestamp.toLocaleString()} • {alert.source}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={alert.severity === 'critical' ? 'destructive' :
                                    alert.severity === 'high' ? 'destructive' :
                                    alert.severity === 'medium' ? 'default' : 'secondary'}
                        >
                          {alert.severity}
                        </Badge>
                        <Badge
                          variant={alert.status === 'open' ? 'destructive' :
                                    alert.status === 'investigating' ? 'default' : 'secondary'}
                        >
                          {alert.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">{alert.description}</p>

                    {alert.details && Object.keys(alert.details).length > 0 && (
                      <div className="bg-muted p-3 rounded-md mb-4">
                        <h5 className="text-sm font-medium mb-2">Details</h5>
                        <div className="space-y-1">
                          {Object.entries(alert.details).map(([key, value]) => (
                            <div key={key} className="text-xs">
                              <span className="font-medium">{key}:</span> {String(value)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {alert.status === 'open' && (
                        <Button
                          size="sm"
                          onClick={() => resolveAlert(alert.id, {
                            action: 'investigating',
                            notes: 'Marked as investigating'
                          })}
                        >
                          Start Investigation
                        </Button>
                      )}
                      {alert.status === 'investigating' && (
                        <Button
                          size="sm"
                          onClick={() => resolveAlert(alert.id, {
                            action: 'resolved',
                            notes: 'Issue resolved successfully'
                          })}
                        >
                          Mark Resolved
                        </Button>
                      )}
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Compliance Management</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleGenerateComplianceReport(ComplianceStandard.GDPR)}
                disabled={isAssessing}
              >
                {isAssessing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                Generate GDPR Report
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleGenerateComplianceReport(ComplianceStandard.SOC2)}
                disabled={isAssessing}
              >
                {isAssessing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                Generate SOC 2 Report
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Compliance Standards */}
            <Card>
              <CardHeader>
                <CardTitle>Compliance Standards</CardTitle>
                <CardDescription>
                  Current status of major compliance frameworks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.values(ComplianceStandard).map((standard) => (
                    <div key={standard} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{standard.replace('_', ' ').toUpperCase()}</span>
                        <Badge variant="outline">Active</Badge>
                      </div>
                      <Progress value={75 + Math.random() * 20} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Assessments */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Assessments</CardTitle>
                <CardDescription>
                  Latest compliance assessment results
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reports.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No compliance assessments available</p>
                ) : (
                  <div className="space-y-3">
                    {reports.slice(0, 5).map((report) => (
                      <div key={report.id} className="border rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-sm">{report.name}</h4>
                          <Badge variant={report.score >= 90 ? 'default' : 'secondary'}>
                            {Math.round(report.score)}%
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          {report.generatedAt.toLocaleDateString()} • {report.findings.length} findings
                        </p>
                        <Progress value={report.score} className="h-1" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Compliance Insights */}
          <Card>
            <CardHeader>
              <CardTitle>Compliance Insights</CardTitle>
              <CardDescription>
                AI-powered compliance recommendations and insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Compliance Strengths
                  </h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Strong access control policies in place</li>
                    <li>• Comprehensive audit logging enabled</li>
                    <li>• Regular security assessments conducted</li>
                    <li>• Data encryption standards met</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    Areas for Improvement
                  </h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Enhance incident response procedures</li>
                    <li>• Implement automated compliance monitoring</li>
                    <li>• Expand security awareness training</li>
                    <li>• Strengthen third-party risk management</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Security Policies</h3>
            <Button variant="outline" size="sm">
              <Policy className="h-4 w-4 mr-2" />
              Create Policy
            </Button>
          </div>

          <div className="grid gap-4">
            {policies.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Policy className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Security Policies</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Security policies help enforce consistent security standards across your organization.
                  </p>
                  <Button>
                    <Policy className="h-4 w-4 mr-2" />
                    Create Your First Policy
                  </Button>
                </CardContent>
              </Card>
            ) : (
              policies.map((policy) => (
                <Card key={policy.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{policy.name}</CardTitle>
                        <CardDescription>{policy.description}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={policy.severity === 'critical' ? 'destructive' :
                                    policy.severity === 'high' ? 'destructive' :
                                    policy.severity === 'medium' ? 'default' : 'secondary'}
                        >
                          {policy.severity}
                        </Badge>
                        <Button
                          variant={policy.enabled ? "default" : "outline"}
                          size="sm"
                          onClick={() => togglePolicy(policy.id, !policy.enabled)}
                        >
                          {policy.enabled ? 'Enabled' : 'Disabled'}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Settings className="h-4 w-4" />
                        <span>Type: {policy.type.replace('_', ' ')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Shield className="h-4 w-4" />
                        <span>Rules: {policy.rules.length}</span>
                      </div>
                      {policy.complianceStandards.length > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4" />
                          <span>Standards: {policy.complianceStandards.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Audit Trail</h3>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Audit Log
            </Button>
          </div>

          <Alert>
            <Database className="h-4 w-4" />
            <AlertTitle>Audit Logging Enabled</AlertTitle>
            <AlertDescription>
              All security events, user actions, and system changes are being logged in real-time.
              Audit logs are retained for 7 years to meet compliance requirements.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Recent Audit Events</CardTitle>
              <CardDescription>
                Latest security and compliance audit events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  {
                    timestamp: new Date(),
                    event: 'User login successful',
                    user: 'john.doe@company.com',
                    risk: 'low'
                  },
                  {
                    timestamp: new Date(Date.now() - 5 * 60 * 1000),
                    event: 'Security policy updated',
                    user: 'admin@company.com',
                    risk: 'medium'
                  },
                  {
                    timestamp: new Date(Date.now() - 15 * 60 * 1000),
                    event: 'Compliance report generated',
                    user: 'system',
                    risk: 'low'
                  }
                ].map((auditEvent, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{auditEvent.event}</p>
                        <p className="text-xs text-muted-foreground">
                          {auditEvent.timestamp.toLocaleString()} • {auditEvent.user}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={auditEvent.risk === 'high' ? 'destructive' :
                                auditEvent.risk === 'medium' ? 'default' : 'secondary'}
                    >
                      {auditEvent.risk}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}