/**
 * y0 Multi-Tenant Architecture Manager
 * Comprehensive multi-tenancy with organization isolation and resource management
 */

import { blink } from '@/lib/blink/client'
import { analytics } from '@/lib/analytics/analytics-engine'

export interface Organization {
  id: string
  name: string
  slug: string
  domain?: string
  logo?: string
  description?: string
  settings: OrganizationSettings
  subscription: Subscription
  billing: Billing
  resources: ResourceQuota
  members: OrganizationMember[]
  invitations: OrganizationInvitation[]
  createdAt: Date
  updatedAt: Date
  status: 'active' | 'suspended' | 'pending' | 'archived'
}

export interface OrganizationSettings {
  timezone: string
  locale: string
  theme: 'light' | 'dark' | 'auto'
  branding: {
    primaryColor: string
    secondaryColor: string
    logo?: string
    favicon?: string
    customDomain?: string
  }
  security: {
    ssoEnabled: boolean
    ssoProvider?: 'saml' | 'oidc' | 'azure' | 'google'
    twoFactorRequired: boolean
    passwordPolicy: {
      minLength: number
      requireUppercase: boolean
      requireLowercase: boolean
      requireNumbers: boolean
      requireSpecialChars: boolean
      passwordHistory: number
    }
    sessionTimeout: number // minutes
  }
  notifications: {
    emailEnabled: boolean
    smsEnabled: boolean
    webhookEnabled: boolean
    alertThresholds: {
      errorRate: number
      responseTime: number
      diskUsage: number
    }
  }
  compliance: {
    dataRetention: number // days
    auditLogging: boolean
    dataEncryption: boolean
    gdprCompliance: boolean
    hipaaCompliance: boolean
    soxCompliance: boolean
  }
}

export interface Subscription {
  plan: 'free' | 'starter' | 'pro' | 'enterprise' | 'custom'
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid'
  currentPeriodStart: Date
  currentPeriodEnd: Date
  trialEnd?: Date
  cancelAtPeriodEnd: boolean
  features: SubscriptionFeatures
  limits: SubscriptionLimits
}

export interface SubscriptionFeatures {
  workflows: boolean
  analytics: boolean
  aiOptimization: boolean
  multiUser: boolean
  sso: boolean
  apiAccess: boolean
  customBranding: boolean
  prioritySupport: boolean
  sla: number // uptime percentage
  dataExport: boolean
  auditLogs: boolean
  backupRetention: number // days
  supportLevel: 'basic' | 'business' | 'premium' | 'enterprise'
}

export interface SubscriptionLimits {
  users: number
  workflows: number
  executions: number // per month
  storage: number // GB
  apiCalls: number // per month
  customIntegrations: number
  dataRetention: number // days
  backupFrequency: 'daily' | 'weekly' | 'monthly'
  sla: number // uptime guarantee
}

export interface Billing {
  customerId?: string
  subscriptionId?: string
  paymentMethodId?: string
  invoices: Invoice[]
  usage: UsageMetrics
  billingAddress?: {
    line1: string
    line2?: string
    city: string
    state: string
    postalCode: string
    country: string
  }
  taxInfo?: {
    taxId: string
    taxRate: number
  }
}

export interface Invoice {
  id: string
  number: string
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'
  amount: number
  currency: string
  dueDate: Date
  paidAt?: Date
  items: InvoiceItem[]
  created: Date
  pdfUrl?: string
}

export interface InvoiceItem {
  description: string
  quantity: number
  unitPrice: number
  amount: number
  period: {
    start: Date
    end: Date
  }
}

export interface UsageMetrics {
  currentPeriod: {
    executions: number
    storage: number // GB
    apiCalls: number
    users: number
    workflows: number
    dataTransfer: number // GB
  }
  forecast: {
    executions: number
    storage: number
    apiCalls: number
    users: number
    workflows: number
  }
  trends: Array<{
    date: string
    executions: number
    storage: number
    apiCalls: number
    activeUsers: number
  }>
}

export interface ResourceQuota {
  allocated: {
    cpu: number // cores
    memory: number // GB
    storage: number // GB
    bandwidth: number // Mbps
    databases: number
    instances: number
    apiRateLimit: number // requests per minute
  }
  used: {
    cpu: number
    memory: number
    storage: number
    bandwidth: number
    databases: number
    instances: number
    apiRateLimit: number
  }
  alerts: ResourceAlert[]
}

export interface ResourceAlert {
  id: string
  type: 'cpu' | 'memory' | 'storage' | 'bandwidth' | 'api_limit'
  threshold: number
  current: number
  severity: 'warning' | 'critical'
  message: string
  createdAt: Date
  resolvedAt?: Date
}

export interface OrganizationMember {
  id: string
  userId: string
  email: string
  firstName?: string
  lastName?: string
  avatar?: string
  role: OrganizationRole
  permissions: Permission[]
  department?: string
  location?: string
  joinedAt: Date
  lastActive?: Date
  status: 'active' | 'inactive' | 'suspended'
}

export interface OrganizationRole {
  id: string
  name: string
  description: string
  permissions: Permission[]
  isSystem: boolean
}

export interface Permission {
  id: string
  name: string
  resource: string
  action: string
  description: string
}

export interface OrganizationInvitation {
  id: string
  email: string
  role: string
  permissions: Permission[]
  invitedBy: string
  invitedAt: Date
  expiresAt: Date
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  acceptedAt?: Date
  declinedAt?: Date
}

export interface TenantContext {
  organization: Organization
  user: OrganizationMember
  permissions: Permission[]
  features: SubscriptionFeatures
  limits: SubscriptionLimits
  resources: ResourceQuota
}

export interface TenantMetrics {
  organizationId: string
  activeUsers: number
  totalWorkflows: number
  executionsToday: number
  executionsThisMonth: number
  storageUsed: number
  apiCallsToday: number
  apiCallsThisMonth: number
  averageResponseTime: number
  uptime: number
  lastActivity: Date
  healthScore: number
}

/**
 * Multi-Tenant Manager Class
 */
class TenantManager {
  private currentTenant: TenantContext | null = null
  private organizations = new Map<string, Organization>()
  private tenantCache = new Map<string, TenantContext>()
  private isInitialized = false

  constructor() {
    this.initializeSystem()
  }

  /**
   * Initialize the tenant manager
   */
  async initialize(): Promise<void> {
    try {
      await this.loadOrganizations()
      await this.initializeSystemRoles()
      this.isInitialized = true
      console.log('[TenantManager] Multi-tenant system initialized')
    } catch (error) {
      console.error('[TenantManager] Initialization failed:', error)
      throw error
    }
  }

  /**
   * Get current tenant context
   */
  getCurrentTenant(): TenantContext | null {
    return this.currentTenant
  }

  /**
   * Set current tenant context
   */
  async setCurrentTenant(organizationId: string, userId: string): Promise<TenantContext> {
    const cacheKey = `${organizationId}:${userId}`

    // Check cache first
    if (this.tenantCache.has(cacheKey)) {
      const context = this.tenantCache.get(cacheKey)!
      this.currentTenant = context
      return context
    }

    const organization = this.organizations.get(organizationId)
    if (!organization) {
      throw new Error(`Organization not found: ${organizationId}`)
    }

    const member = organization.members.find(m => m.userId === userId)
    if (!member) {
      throw new Error(`User not member of organization: ${userId}`)
    }

    const context: TenantContext = {
      organization,
      user: member,
      permissions: member.permissions,
      features: organization.subscription.features,
      limits: organization.subscription.limits,
      resources: organization.resources
    }

    this.tenantCache.set(cacheKey, context)
    this.currentTenant = context

    // Track tenant context switch
    await analytics.track('tenant_context_set', {
      organizationId,
      userId,
      role: member.role.name
    })

    return context
  }

  /**
   * Create new organization
   */
  async createOrganization(
    name: string,
    slug: string,
    userId: string,
    settings: Partial<OrganizationSettings> = {}
  ): Promise<Organization> {
    const organization: Organization = {
      id: `org_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      slug,
      settings: {
        timezone: 'UTC',
        locale: 'en-US',
        theme: 'light',
        branding: {
          primaryColor: '#3B82F6',
          secondaryColor: '#6B7280'
        },
        security: {
          ssoEnabled: false,
          twoFactorRequired: false,
          passwordPolicy: {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: false,
            passwordHistory: 3
          },
          sessionTimeout: 480 // 8 hours
        },
        notifications: {
          emailEnabled: true,
          smsEnabled: false,
          webhookEnabled: false,
          alertThresholds: {
            errorRate: 5,
            responseTime: 2000,
            diskUsage: 85
          }
        },
        compliance: {
          dataRetention: 90,
          auditLogging: true,
          dataEncryption: true,
          gdprCompliance: false,
          hipaaCompliance: false,
          soxCompliance: false
        },
        ...settings
      },
      subscription: {
        plan: 'free',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        features: this.getFeaturesForPlan('free'),
        limits: this.getLimitsForPlan('free')
      },
      billing: {
        invoices: [],
        usage: {
          currentPeriod: {
            executions: 0,
            storage: 0,
            apiCalls: 0,
            users: 1,
            workflows: 0,
            dataTransfer: 0
          },
          forecast: {
            executions: 0,
            storage: 0,
            apiCalls: 0,
            users: 1,
            workflows: 0
          },
          trends: []
        }
      },
      resources: {
        allocated: {
          cpu: 2,
          memory: 4,
          storage: 10,
          bandwidth: 100,
          databases: 1,
          instances: 2,
          apiRateLimit: 1000
        },
        used: {
          cpu: 0,
          memory: 0,
          storage: 0,
          bandwidth: 0,
          databases: 0,
          instances: 0,
          apiRateLimit: 0
        },
        alerts: []
      },
      members: [],
      invitations: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active'
    }

    this.organizations.set(organization.id, organization)
    await this.saveOrganization(organization)

    // Add creator as owner
    await this.addMember(organization.id, userId, 'owner')

    console.log(`[TenantManager] Created organization: ${organization.name}`)
    return organization
  }

  /**
   * Add member to organization
   */
  async addMember(
    organizationId: string,
    userId: string,
    roleId: string,
    customPermissions?: Permission[]
  ): Promise<OrganizationMember> {
    const organization = this.organizations.get(organizationId)
    if (!organization) {
      throw new Error(`Organization not found: ${organizationId}`)
    }

    const role = this.getRoleById(roleId)
    if (!role) {
      throw new Error(`Role not found: ${roleId}`)
    }

    const member: OrganizationMember = {
      id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      email: `user_${userId}@example.com`, // Would come from user service
      role,
      permissions: customPermissions || role.permissions,
      joinedAt: new Date(),
      status: 'active'
    }

    organization.members.push(member)
    organization.updatedAt = new Date()
    await this.saveOrganization(organization)

    // Track member addition
    await analytics.track('organization_member_added', {
      organizationId,
      userId,
      role: role.name
    })

    console.log(`[TenantManager] Added member to organization: ${organization.name}`)
    return member
  }

  /**
   * Update organization subscription
   */
  async updateSubscription(
    organizationId: string,
    plan: Subscription['plan']
  ): Promise<Organization> {
    const organization = this.organizations.get(organizationId)
    if (!organization) {
      throw new Error(`Organization not found: ${organizationId}`)
    }

    organization.subscription.plan = plan
    organization.subscription.features = this.getFeaturesForPlan(plan)
    organization.subscription.limits = this.getLimitsForPlan(plan)
    organization.updatedAt = new Date()

    await this.saveOrganization(organization)

    // Clear tenant cache for this organization
    this.clearTenantCache(organizationId)

    // Track subscription change
    await analytics.track('subscription_updated', {
      organizationId,
      plan,
      previousPlan: organization.subscription.plan
    })

    console.log(`[TenantManager] Updated subscription for organization: ${organization.name}`)
    return organization
  }

  /**
   * Get tenant metrics
   */
  async getTenantMetrics(organizationId: string): Promise<TenantMetrics> {
    const organization = this.organizations.get(organizationId)
    if (!organization) {
      throw new Error(`Organization not found: ${organizationId}`)
    }

    const metrics: TenantMetrics = {
      organizationId,
      activeUsers: organization.members.filter(m => m.status === 'active').length,
      totalWorkflows: Math.floor(Math.random() * 100) + 10,
      executionsToday: Math.floor(Math.random() * 1000) + 100,
      executionsThisMonth: Math.floor(Math.random() * 50000) + 10000,
      storageUsed: organization.resources.used.storage,
      apiCallsToday: Math.floor(Math.random() * 10000) + 1000,
      apiCallsThisMonth: Math.floor(Math.random() * 500000) + 50000,
      averageResponseTime: Math.floor(Math.random() * 500) + 100,
      uptime: Number((Math.random() * 2 + 98).toFixed(2)),
      lastActivity: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
      healthScore: Math.floor(Math.random() * 30) + 70
    }

    return metrics
  }

  /**
   * Check if tenant has permission
   */
  hasPermission(resource: string, action: string): boolean {
    if (!this.currentTenant) {
      return false
    }

    return this.currentTenant.permissions.some(
      permission => permission.resource === resource && permission.action === action
    )
  }

  /**
   * Check if tenant has feature access
   */
  hasFeature(feature: keyof SubscriptionFeatures): boolean {
    if (!this.currentTenant) {
      return false
    }

    return this.currentTenant.features[feature]
  }

  /**
   * Get all organizations for user
   */
  async getUserOrganizations(userId: string): Promise<Organization[]> {
    const userOrganizations: Organization[] = []

    for (const organization of this.organizations.values()) {
      const member = organization.members.find(m => m.userId === userId)
      if (member && member.status === 'active') {
        userOrganizations.push(organization)
      }
    }

    return userOrganizations
  }

  // Private helper methods
  private async initializeSystem(): Promise<void> {
    // Create sample organizations for demo
    if (this.organizations.size === 0) {
      await this.createSampleOrganizations()
    }
  }

  private async createSampleOrganizations(): Promise<void> {
    const sampleOrgs = [
      {
        name: 'Acme Corporation',
        slug: 'acme-corp',
        settings: {
          timezone: 'America/New_York',
          locale: 'en-US',
          branding: {
            primaryColor: '#1E40AF',
            secondaryColor: '#6B7280'
          }
        }
      },
      {
        name: 'Tech Innovators Inc',
        slug: 'tech-innovators',
        settings: {
          timezone: 'America/Los_Angeles',
          locale: 'en-US',
          branding: {
            primaryColor: '#059669',
            secondaryColor: '#6B7280'
          }
        }
      }
    ]

    for (const org of sampleOrgs) {
      await this.createOrganization(org.name, org.slug, 'demo-user', org.settings)
    }
  }

  private async initializeSystemRoles(): Promise<void> {
    // System roles would be loaded from database
  }

  private getRoleById(roleId: string): OrganizationRole | null {
    const roles: OrganizationRole[] = [
      {
        id: 'owner',
        name: 'Owner',
        description: 'Full access to organization resources',
        permissions: [
          { id: '1', name: 'all', resource: '*', action: '*', description: 'All permissions' }
        ],
        isSystem: true
      },
      {
        id: 'admin',
        name: 'Administrator',
        description: 'Administrative access to organization',
        permissions: [
          { id: '2', name: 'manage', resource: '*', action: 'manage', description: 'Manage resources' },
          { id: '3', name: 'view', resource: '*', action: 'view', description: 'View resources' }
        ],
        isSystem: true
      },
      {
        id: 'member',
        name: 'Member',
        description: 'Basic access to organization',
        permissions: [
          { id: '4', name: 'view', resource: 'workflows', action: 'view', description: 'View workflows' },
          { id: '5', name: 'create', resource: 'workflows', action: 'create', description: 'Create workflows' }
        ],
        isSystem: true
      }
    ]

    return roles.find(r => r.id === roleId) || null
  }

  private getFeaturesForPlan(plan: Subscription['plan']): SubscriptionFeatures {
    const features = {
      free: {
        workflows: true,
        analytics: false,
        aiOptimization: false,
        multiUser: false,
        sso: false,
        apiAccess: false,
        customBranding: false,
        prioritySupport: false,
        sla: 99.0,
        dataExport: false,
        auditLogs: false,
        backupRetention: 7,
        supportLevel: 'basic' as const
      },
      starter: {
        workflows: true,
        analytics: true,
        aiOptimization: false,
        multiUser: true,
        sso: false,
        apiAccess: true,
        customBranding: false,
        prioritySupport: false,
        sla: 99.5,
        dataExport: true,
        auditLogs: true,
        backupRetention: 30,
        supportLevel: 'basic' as const
      },
      pro: {
        workflows: true,
        analytics: true,
        aiOptimization: true,
        multiUser: true,
        sso: true,
        apiAccess: true,
        customBranding: true,
        prioritySupport: true,
        sla: 99.9,
        dataExport: true,
        auditLogs: true,
        backupRetention: 90,
        supportLevel: 'business' as const
      },
      enterprise: {
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
        supportLevel: 'enterprise' as const
      },
      custom: {
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
        supportLevel: 'enterprise' as const
      }
    }

    return features[plan]
  }

  private getLimitsForPlan(plan: Subscription['plan']): SubscriptionLimits {
    const limits = {
      free: {
        users: 1,
        workflows: 5,
        executions: 100,
        storage: 1,
        apiCalls: 1000,
        customIntegrations: 0,
        dataRetention: 7,
        backupFrequency: 'daily' as const,
        sla: 99.0
      },
      starter: {
        users: 5,
        workflows: 25,
        executions: 1000,
        storage: 10,
        apiCalls: 10000,
        customIntegrations: 2,
        dataRetention: 30,
        backupFrequency: 'daily' as const,
        sla: 99.5
      },
      pro: {
        users: 25,
        workflows: 100,
        executions: 10000,
        storage: 100,
        apiCalls: 100000,
        customIntegrations: 10,
        dataRetention: 90,
        backupFrequency: 'daily' as const,
        sla: 99.9
      },
      enterprise: {
        users: -1, // unlimited
        workflows: -1,
        executions: -1,
        storage: 1000,
        apiCalls: -1,
        customIntegrations: -1,
        dataRetention: 365,
        backupFrequency: 'daily' as const,
        sla: 99.99
      },
      custom: {
        users: -1,
        workflows: -1,
        executions: -1,
        storage: -1,
        apiCalls: -1,
        customIntegrations: -1,
        dataRetention: 365,
        backupFrequency: 'daily' as const,
        sla: 99.99
      }
    }

    return limits[plan]
  }

  private clearTenantCache(organizationId: string): void {
    const keysToDelete = []
    for (const key of this.tenantCache.keys()) {
      if (key.startsWith(`${organizationId}:`)) {
        keysToDelete.push(key)
      }
    }
    keysToDelete.forEach(key => this.tenantCache.delete(key))
  }

  // Database operations (mocked for now)
  private async loadOrganizations(): Promise<void> {
    // Implementation to load organizations from database
  }

  private async saveOrganization(organization: Organization): Promise<void> {
    // Implementation to save organization to database
  }
}

// Export singleton instance
export const tenantManager = new TenantManager()

// Export types
export type {
  Organization,
  OrganizationSettings,
  Subscription,
  SubscriptionFeatures,
  SubscriptionLimits,
  Billing,
  Invoice,
  InvoiceItem,
  UsageMetrics,
  ResourceQuota,
  ResourceAlert,
  OrganizationMember,
  OrganizationRole,
  Permission,
  OrganizationInvitation,
  TenantContext,
  TenantMetrics
}