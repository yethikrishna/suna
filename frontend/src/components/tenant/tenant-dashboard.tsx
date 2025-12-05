/**
 * y0 Multi-Tenant Dashboard
 * Comprehensive organization management and resource monitoring
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Building2,
  Users,
  Settings,
  Shield,
  CreditCard,
  Activity,
  TrendingUp,
  Globe,
  Lock,
  Zap,
  Server,
  Database,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Edit,
  Trash2,
  Plus,
  Crown,
  Star,
  Target
} from 'lucide-react'
import { tenantManager, Organization, TenantMetrics, UsageMetrics } from '@/lib/tenant/tenant-manager'

export function TenantDashboard() {
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [metrics, setMetrics] = useState<TenantMetrics | null>(null)
  const [usage, setUsage] = useState<UsageMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState('overview')

  useEffect(() => {
    loadTenantData()
    const interval = setInterval(loadTenantData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const loadTenantData = async () => {
    try {
      // Mock organization data - in real app would come from auth context
      const mockOrg: Organization = {
        id: 'org_acme_corp',
        name: 'Acme Corporation',
        slug: 'acme-corp',
        domain: 'acme.y0.com',
        description: 'Leading technology solutions provider',
        settings: {
          timezone: 'America/New_York',
          locale: 'en-US',
          theme: 'light',
          branding: {
            primaryColor: '#1E40AF',
            secondaryColor: '#6B7280',
            logo: '/logo.png',
            customDomain: 'acme.y0.com'
          },
          security: {
            ssoEnabled: true,
            ssoProvider: 'saml',
            twoFactorRequired: true,
            passwordPolicy: {
              minLength: 12,
              requireUppercase: true,
              requireLowercase: true,
              requireNumbers: true,
              requireSpecialChars: true,
              passwordHistory: 5
            },
            sessionTimeout: 480
          },
          notifications: {
            emailEnabled: true,
            smsEnabled: true,
            webhookEnabled: true,
            alertThresholds: {
              errorRate: 5,
              responseTime: 2000,
              diskUsage: 85
            }
          },
          compliance: {
            dataRetention: 365,
            auditLogging: true,
            dataEncryption: true,
            gdprCompliance: true,
            hipaaCompliance: false,
            soxCompliance: true
          }
        },
        subscription: {
          plan: 'enterprise',
          status: 'active',
          currentPeriodStart: new Date('2024-01-01'),
          currentPeriodEnd: new Date('2024-12-31'),
          cancelAtPeriodEnd: false,
          features: {
            workflows: true,
            analytics: true,
            aiOptimization: true,
            multiUser: true,
            sso: true,
            apiAccess: true,
            customBranding: true,
            prioritySupport: true,
            sla: 99.99,
            dataExport: true,
            auditLogs: true,
            backupRetention: 365,
            supportLevel: 'enterprise'
          },
          limits: {
            users: -1,
            workflows: -1,
            executions: -1,
            storage: 1000,
            apiCalls: -1,
            customIntegrations: -1,
            dataRetention: 365,
            backupFrequency: 'daily',
            sla: 99.99
          }
        },
        billing: {
          invoices: [],
          usage: {
            currentPeriod: {
              executions: 2456789,
              storage: 234.5,
              apiCalls: 56789012,
              users: 47,
              workflows: 234,
              dataTransfer: 1234.7
            },
            forecast: {
              executions: 3000000,
              storage: 280,
              apiCalls: 68000000,
              users: 50,
              workflows: 250
            },
            trends: []
          }
        },
        resources: {
          allocated: {
            cpu: 16,
            memory: 64,
            storage: 1000,
            bandwidth: 1000,
            databases: 5,
            instances: 10,
            apiRateLimit: 10000
          },
          used: {
            cpu: 12.4,
            memory: 45.2,
            storage: 234.5,
            bandwidth: 567.8,
            databases: 3,
            instances: 7,
            apiRateLimit: 5678
          },
          alerts: []
        },
        members: [],
        invitations: [],
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date(),
        status: 'active'
      }

      const mockMetrics: TenantMetrics = {
        organizationId: mockOrg.id,
        activeUsers: 47,
        totalWorkflows: 234,
        executionsToday: 12567,
        executionsThisMonth: 2456789,
        storageUsed: 234.5,
        apiCallsToday: 1234567,
        apiCallsThisMonth: 56789012,
        averageResponseTime: 156,
        uptime: 99.97,
        lastActivity: new Date(Date.now() - 15 * 60 * 1000),
        healthScore: 94
      }

      setOrganization(mockOrg)
      setMetrics(mockMetrics)
      setUsage(mockOrg.billing.usage)
      setIsLoading(false)
    } catch (error) {
      console.error('Failed to load tenant data:', error)
      setIsLoading(false)
    }
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  const formatBytes = (bytes: number): string => {
    const sizes = ['GB', 'TB']
    const gb = bytes / 1024
    if (gb >= 1024) {
      return `${(gb / 1024).toFixed(1)} TB`
    }
    return `${gb.toFixed(1)} GB`
  }

  const getPlanIcon = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return <Crown className="h-4 w-4 text-yellow-500" />
      case 'pro':
        return <Star className="h-4 w-4 text-purple-500" />
      case 'starter':
        return <Target className="h-4 w-4 text-blue-500" />
      default:
        return <Shield className="h-4 w-4 text-gray-500" />
    }
  }

  const getUsagePercentage = (used: number, allocated: number): number => {
    if (allocated === -1) return 0 // unlimited
    return Math.min((used / allocated) * 100, 100)
  }

  const getUsageColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-red-600'
    if (percentage >= 75) return 'text-yellow-600'
    return 'text-green-600'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Activity className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading organization data...</span>
      </div>
    )
  }

  if (!organization) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold">No Organization Found</h3>
        <p className="text-muted-foreground">You don't have access to any organizations.</p>
        <Button className="mt-4">
          <Plus className="h-4 w-4 mr-2" />
          Create Organization
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            {organization.settings.branding.logo && (
              <img
                src={organization.settings.branding.logo}
                alt={organization.name}
                className="h-8 w-8 rounded"
              />
            )}
            {organization.name}
            <Badge variant="outline" className="ml-2">
              {getPlanIcon(organization.subscription.plan)}
              {organization.subscription.plan.charAt(0).toUpperCase() + organization.subscription.plan.slice(1)}
            </Badge>
          </h1>
          <p className="text-muted-foreground">{organization.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button variant="outline" size="sm">
            <CreditCard className="h-4 w-4 mr-2" />
            Billing
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.activeUsers || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {organization.subscription.limits.users === -1 ? 'Unlimited' : `${organization.subscription.limits.users} licensed`}
            </p>
            <Progress
              value={getUsagePercentage(metrics?.activeUsers || 0, organization.subscription.limits.users)}
              className="h-1 mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workflows</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalWorkflows || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatNumber(metrics?.executionsToday || 0)} executions today
            </p>
            <div className="flex items-center gap-1 mt-2">
              <ArrowUpRight className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-500">+12% from yesterday</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(organization.resources.used.storage * 1024)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              of {formatBytes(organization.resources.allocated.storage * 1024)} allocated
            </p>
            <Progress
              value={getUsagePercentage(organization.resources.used.storage, organization.resources.allocated.storage)}
              className="h-1 mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.healthScore || 0}/100</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.uptime || 0}% uptime
            </p>
            <div className="flex items-center gap-1 mt-2">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-500">All systems operational</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Resource Usage */}
            <Card>
              <CardHeader>
                <CardTitle>Resource Usage</CardTitle>
                <CardDescription>
                  Current resource consumption and allocation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { name: 'CPU Usage', used: organization.resources.used.cpu, allocated: organization.resources.allocated.cpu, unit: 'cores' },
                    { name: 'Memory', used: organization.resources.used.memory, allocated: organization.resources.allocated.memory, unit: 'GB' },
                    { name: 'Storage', used: organization.resources.used.storage, allocated: organization.resources.allocated.storage, unit: 'GB' },
                    { name: 'Bandwidth', used: organization.resources.used.bandwidth, allocated: organization.resources.allocated.bandwidth, unit: 'Mbps' }
                  ].map((resource) => {
                    const percentage = getUsagePercentage(resource.used, resource.allocated)
                    return (
                      <div key={resource.name} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{resource.name}</span>
                          <span className={getUsageColor(percentage)}>
                            {resource.used}/{resource.allocated === -1 ? '∞' : resource.allocated} {resource.unit}
                          </span>
                        </div>
                        <Progress value={resource.allocated === -1 ? 0 : percentage} className="h-2" />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest actions and events in your organization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { user: 'John Doe', action: 'Created new workflow', time: '2 minutes ago', icon: <Zap className="h-4 w-4 text-blue-500" /> },
                    { user: 'Jane Smith', action: 'Updated security settings', time: '15 minutes ago', icon: <Shield className="h-4 w-4 text-green-500" /> },
                    { user: 'Mike Johnson', action: 'Invited new team member', time: '1 hour ago', icon: <Users className="h-4 w-4 text-purple-500" /> },
                    { user: 'Sarah Wilson', action: 'Generated analytics report', time: '2 hours ago', icon: <TrendingUp className="h-4 w-4 text-orange-500" /> }
                  ].map((activity, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded border">
                      {activity.icon}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{activity.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.user} • {activity.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>
                System performance and response times
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="text-center">
                  <p className="text-sm font-medium">Avg Response Time</p>
                  <p className="text-2xl font-bold">{metrics?.averageResponseTime || 0}ms</p>
                  <p className="text-xs text-muted-foreground">Last 24 hours</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">API Calls Today</p>
                  <p className="text-2xl font-bold">{formatNumber(metrics?.apiCallsToday || 0)}</p>
                  <p className="text-xs text-muted-foreground">+8% from yesterday</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Executions Today</p>
                  <p className="text-2xl font-bold">{formatNumber(metrics?.executionsToday || 0)}</p>
                  <p className="text-xs text-muted-foreground">Across all workflows</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Uptime</p>
                  <p className="text-2xl font-bold">{metrics?.uptime || 0}%</p>
                  <p className="text-xs text-muted-foreground">SLA: {organization.subscription.features.sla}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Current Period Usage */}
            <Card>
              <CardHeader>
                <CardTitle>Current Period Usage</CardTitle>
                <CardDescription>
                  Usage metrics for the current billing period
                </CardDescription>
              </CardHeader>
              <CardContent>
                {usage && (
                  <div className="space-y-4">
                    {[
                      { name: 'API Calls', current: usage.currentPeriod.apiCalls, forecast: usage.forecast.apiCalls },
                      { name: 'Executions', current: usage.currentPeriod.executions, forecast: usage.forecast.executions },
                      { name: 'Storage (GB)', current: usage.currentPeriod.storage, forecast: usage.forecast.storage },
                      { name: 'Active Users', current: usage.currentPeriod.users, forecast: usage.forecast.users },
                      { name: 'Workflows', current: usage.currentPeriod.workflows, forecast: usage.forecast.workflows }
                    ].map((metric) => (
                      <div key={metric.name} className="flex justify-between items-center p-3 border rounded">
                        <span className="font-medium">{metric.name}</span>
                        <div className="text-right">
                          <p className="font-semibold">{formatNumber(metric.current)}</p>
                          <p className="text-xs text-muted-foreground">
                            Forecast: {formatNumber(metric.forecast)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Usage Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Usage Trends</CardTitle>
                <CardDescription>
                  Historical usage patterns and projections
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Usage trends chart would be displayed here</p>
                    <p className="text-sm">Showing 30-day usage history</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>
                    Manage users and their access permissions
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold">Team Management</h3>
                <p>Invite team members and manage their roles and permissions</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Security Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>
                  Organization security configuration and policies
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { setting: 'Single Sign-On (SSO)', enabled: organization.settings.security.ssoEnabled, icon: <Globe className="h-4 w-4" /> },
                    { setting: 'Two-Factor Authentication', enabled: organization.settings.security.twoFactorRequired, icon: <Lock className="h-4 w-4" /> },
                    { setting: 'Data Encryption', enabled: organization.settings.compliance.dataEncryption, icon: <Shield className="h-4 w-4" /> },
                    { setting: 'Audit Logging', enabled: organization.settings.compliance.auditLogging, icon: <Eye className="h-4 w-4" /> }
                  ].map((item) => (
                    <div key={item.setting} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-3">
                        {item.icon}
                        <span className="font-medium">{item.setting}</span>
                      </div>
                      <Badge variant={item.enabled ? 'default' : 'secondary'}>
                        {item.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Compliance Status */}
            <Card>
              <CardHeader>
                <CardTitle>Compliance Status</CardTitle>
                <CardDescription>
                  Regulatory compliance and certifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { standard: 'GDPR', compliant: organization.settings.compliance.gdprCompliance },
                    { standard: 'SOX', compliant: organization.settings.compliance.soxCompliance },
                    { standard: 'HIPAA', compliant: organization.settings.compliance.hipaaCompliance },
                    { standard: 'Data Retention', compliant: organization.settings.compliance.dataRetention > 0 }
                  ].map((item) => (
                    <div key={item.standard} className="flex items-center justify-between p-3 border rounded">
                      <span className="font-medium">{item.standard}</span>
                      <Badge variant={item.compliant ? 'default' : 'secondary'}>
                        {item.compliant ? 'Compliant' : 'Not Compliant'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Subscription Plan */}
            <Card>
              <CardHeader>
                <CardTitle>Subscription Plan</CardTitle>
                <CardDescription>
                  Current plan and available features
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getPlanIcon(organization.subscription.plan)}
                      <div>
                        <p className="font-semibold capitalize">{organization.subscription.plan} Plan</p>
                        <p className="text-sm text-muted-foreground">
                          {organization.subscription.features.sla}% SLA • Priority Support
                        </p>
                      </div>
                    </div>
                    <Badge variant="default">
                      {organization.subscription.status}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <p className="font-medium">Included Features:</p>
                    {Object.entries(organization.subscription.features)
                      .filter(([key]) => organization.subscription.features[key as keyof typeof organization.subscription.features])
                      .map(([key]) => (
                        <div key={key} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Billing History */}
            <Card>
              <CardHeader>
                <CardTitle>Billing & Usage</CardTitle>
                <CardDescription>
                  Current period usage and billing information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <CreditCard className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold">Billing Overview</h3>
                  <p>View invoices, payment methods, and usage charges</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}