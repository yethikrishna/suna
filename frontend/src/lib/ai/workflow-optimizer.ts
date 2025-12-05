/**
 * y0 AI Workflow Optimizer
 * AI-powered workflow optimization and auto-tuning capabilities
 */

import { blink } from '@/lib/blink/client'
import { analytics } from '@/lib/analytics/analytics-engine'

export interface WorkflowPerformanceMetrics {
  workflowId: string
  executionCount: number
  successRate: number
  averageExecutionTime: number
  errorRate: number
  lastExecuted: Date
  throughput: number // executions per hour
  resourceUsage: {
    cpu: number
    memory: number
    network: number
  }
  bottleneckSteps?: string[]
  optimizationOpportunities?: OptimizationOpportunity[]
}

export interface OptimizationOpportunity {
  type: 'performance' | 'reliability' | 'cost' | 'resource'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  affectedSteps: string[]
  estimatedImprovement: {
    performance?: number // percentage
    reliability?: number // percentage
    cost?: number // percentage
  }
  suggestedChanges: SuggestedChange[]
  implementationComplexity: 'simple' | 'moderate' | 'complex'
}

export interface SuggestedChange {
  type: 'parallel' | 'retry' | 'cache' | 'batch' | 'timeout' | 'resource'
  description: string
  target: string // step ID or workflow level
  parameters: Record<string, any>
  confidence: number // 0-1
  reasoning: string
}

export interface OptimizationRecommendation {
  id: string
  workflowId: string
  createdAt: Date
  appliedAt?: Date
  status: 'pending' | 'approved' | 'rejected' | 'applied' | 'failed'
  opportunities: OptimizationOpportunity[]
  expectedImpact: {
    performance: number
    reliability: number
    cost: number
  }
  riskLevel: 'low' | 'medium' | 'high'
  rollbackPlan: string
}

export interface AutoTuningConfig {
  enabled: boolean
  autoApply: boolean // automatically apply approved optimizations
  riskThreshold: number // maximum acceptable risk level
  minimumConfidence: number // minimum confidence for auto-application
  optimizationFrequency: 'hourly' | 'daily' | 'weekly'
  excludeWorkflows: string[]
  monitorMode: boolean // only analyze, don't apply changes
}

/**
 * AI Workflow Optimizer Class
 */
class WorkflowOptimizer {
  private config: AutoTuningConfig
  private isInitialized = false
  private optimizationHistory = new Map<string, OptimizationRecommendation[]>()

  constructor(config: Partial<AutoTuningConfig> = {}) {
    this.config = {
      enabled: true,
      autoApply: false,
      riskThreshold: 0.3,
      minimumConfidence: 0.8,
      optimizationFrequency: 'daily',
      excludeWorkflows: [],
      monitorMode: true,
      ...config
    }
  }

  /**
   * Initialize the workflow optimizer
   */
  async initialize(): Promise<void> {
    try {
      // Load existing optimization history
      await this.loadOptimizationHistory()

      // Start periodic optimization if enabled
      if (this.config.enabled && !this.config.monitorMode) {
        this.startPeriodicOptimization()
      }

      this.isInitialized = true
      console.log('[WorkflowOptimizer] Initialized successfully')
    } catch (error) {
      console.error('[WorkflowOptimizer] Initialization failed:', error)
      throw error
    }
  }

  /**
   * Analyze workflow performance and identify optimization opportunities
   */
  async analyzeWorkflow(workflowId: string): Promise<WorkflowPerformanceMetrics> {
    try {
      // Get workflow execution history
      const executionHistory = await this.getWorkflowExecutionHistory(workflowId, 30) // last 30 days

      // Calculate performance metrics
      const metrics = this.calculatePerformanceMetrics(workflowId, executionHistory)

      // Identify optimization opportunities using AI analysis
      metrics.optimizationOpportunities = await this.identifyOptimizationOpportunities(metrics)

      // Track analysis event
      analytics.track({
        type: 'system_event' as any,
        category: 'monitoring' as any,
        action: 'workflow_analyzed',
        properties: {
          workflowId,
          executionCount: metrics.executionCount,
          successRate: metrics.successRate,
          opportunitiesCount: metrics.optimizationOpportunities?.length || 0
        }
      })

      return metrics
    } catch (error) {
      console.error(`[WorkflowOptimizer] Failed to analyze workflow ${workflowId}:`, error)
      throw error
    }
  }

  /**
   * Generate optimization recommendations
   */
  async generateRecommendations(workflowId: string): Promise<OptimizationRecommendation> {
    try {
      const metrics = await this.analyzeWorkflow(workflowId)

      if (!metrics.optimizationOpportunities || metrics.optimizationOpportunities.length === 0) {
        throw new Error('No optimization opportunities found')
      }

      // Filter opportunities based on configuration
      const filteredOpportunities = metrics.optimizationOpportunities.filter(opportunity =>
        this.calculateOpportunityConfidence(opportunity) >= this.config.minimumConfidence
      )

      if (filteredOpportunities.length === 0) {
        throw new Error('No optimization opportunities meet confidence threshold')
      }

      // Calculate expected impact
      const expectedImpact = this.calculateExpectedImpact(filteredOpportunities)

      // Assess risk level
      const riskLevel = this.assessRiskLevel(filteredOpportunities)

      // Generate rollback plan
      const rollbackPlan = this.generateRollbackPlan(filteredOpportunities)

      const recommendation: OptimizationRecommendation = {
        id: this.generateRecommendationId(),
        workflowId,
        createdAt: new Date(),
        status: 'pending',
        opportunities: filteredOpportunities,
        expectedImpact,
        riskLevel,
        rollbackPlan
      }

      // Store recommendation
      await this.storeRecommendation(recommendation)

      return recommendation
    } catch (error) {
      console.error(`[WorkflowOptimizer] Failed to generate recommendations for ${workflowId}:`, error)
      throw error
    }
  }

  /**
   * Apply optimization recommendations
   */
  async applyRecommendation(recommendationId: string, autoApply = false): Promise<boolean> {
    try {
      const recommendation = await this.getRecommendation(recommendationId)

      if (!recommendation) {
        throw new Error('Recommendation not found')
      }

      if (recommendation.status !== 'pending') {
        throw new Error('Recommendation has already been processed')
      }

      // Check if auto-application is allowed
      if (autoApply && !this.config.autoApply) {
        throw new Error('Auto-application is disabled')
      }

      // Validate risk level
      const riskScore = this.getRiskScore(recommendation.riskLevel)
      if (riskScore > this.config.riskThreshold) {
        throw new Error(`Risk level ${recommendation.riskLevel} exceeds threshold ${this.config.riskThreshold}`)
      }

      // Apply optimizations in order of severity (low to high)
      const sortedOpportunities = recommendation.opportunities.sort((a, b) =>
        this.getSeverityScore(b.severity) - this.getSeverityScore(a.severity)
      )

      let appliedCount = 0
      const errors: string[] = []

      for (const opportunity of sortedOpportunities) {
        try {
          await this.applyOpportunity(recommendation.workflowId, opportunity)
          appliedCount++
        } catch (error) {
          errors.push(`Failed to apply ${opportunity.type} optimization: ${error}`)
          // Continue with other opportunities
        }
      }

      // Update recommendation status
      recommendation.status = errors.length > 0 ? 'failed' : 'applied'
      recommendation.appliedAt = new Date()

      await this.updateRecommendation(recommendation)

      // Track application event
      analytics.track({
        type: 'system_event' as any,
        category: 'monitoring' as any,
        action: 'optimization_applied',
        properties: {
          recommendationId,
          workflowId: recommendation.workflowId,
          appliedCount,
          totalOpportunities: recommendation.opportunities.length,
          riskLevel: recommendation.riskLevel,
          errors: errors.length
        }
      })

      return appliedCount === recommendation.opportunities.length

    } catch (error) {
      console.error(`[WorkflowOptimizer] Failed to apply recommendation ${recommendationId}:`, error)
      throw error
    }
  }

  /**
   * Get optimization insights for multiple workflows
   */
  async getOptimizationInsights(workflowIds?: string[]): Promise<{
    totalOptimizations: number
    highImpactOpportunities: number
    averageImprovementPotential: number
    riskDistribution: Record<string, number>
    topOptimizationTypes: Array<{ type: string; count: number }>
    workflowMetrics: WorkflowPerformanceMetrics[]
  }> {
    try {
      const workflows = workflowIds || await this.getAllWorkflowIds()
      const workflowMetrics: WorkflowPerformanceMetrics[] = []

      for (const workflowId of workflows) {
        if (!this.config.excludeWorkflows.includes(workflowId)) {
          try {
            const metrics = await this.analyzeWorkflow(workflowId)
            workflowMetrics.push(metrics)
          } catch (error) {
            console.warn(`[WorkflowOptimizer] Failed to analyze workflow ${workflowId}:`, error)
          }
        }
      }

      // Aggregate insights
      const allOpportunities = workflowMetrics.flatMap(wm => wm.optimizationOpportunities || [])
      const highImpactOpportunities = allOpportunities.filter(op =>
        op.severity === 'high' || op.severity === 'critical'
      )

      const averageImprovementPotential = allOpportunities.length > 0
        ? allOpportunities.reduce((sum, op) => {
            const improvement = (op.estimatedImprovement.performance || 0) +
                               (op.estimatedImprovement.reliability || 0) +
                               (op.estimatedImprovement.cost || 0)
            return sum + improvement / 3
          }, 0) / allOpportunities.length
        : 0

      const riskDistribution = allOpportunities.reduce((dist, op) => {
        dist[op.severity] = (dist[op.severity] || 0) + 1
        return dist
      }, {} as Record<string, number>)

      const optimizationTypes = allOpportunities.reduce((types, op) => {
        const existing = types.find(t => t.type === op.type)
        if (existing) {
          existing.count++
        } else {
          types.push({ type: op.type, count: 1 })
        }
        return types
      }, [] as Array<{ type: string; count: number }>)

      return {
        totalOptimizations: allOpportunities.length,
        highImpactOpportunities: highImpactOpportunities.length,
        averageImprovementPotential,
        riskDistribution,
        topOptimizationTypes: optimizationTypes.sort((a, b) => b.count - a.count).slice(0, 5),
        workflowMetrics
      }
    } catch (error) {
      console.error('[WorkflowOptimizer] Failed to get optimization insights:', error)
      throw error
    }
  }

  /**
   * Private helper methods
   */

  private async getWorkflowExecutionHistory(workflowId: string, days: number): Promise<any[]> {
    try {
      // Query workflow executions from analytics
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

      const query = {
        timeRange: { start: startDate, end: endDate },
        filters: [
          { field: 'category', operator: 'eq', value: 'workflow' },
          { field: 'properties.workflowId', operator: 'eq', value: workflowId }
        ],
        metrics: [{ name: 'executions', type: 'count' }]
      }

      const data = await analytics.getAnalyticsData(query)

      // This would normally query from the actual workflow execution logs
      // For now, return mock data based on analytics
      return this.generateMockExecutionHistory(workflowId, days)
    } catch (error) {
      console.error('Failed to get workflow execution history:', error)
      return []
    }
  }

  private generateMockExecutionHistory(workflowId: string, days: number): any[] {
    const executions = []
    const now = new Date()

    for (let i = 0; i < days * 24; i++) { // hourly executions
      const executionTime = new Date(now.getTime() - i * 60 * 60 * 1000)
      const success = Math.random() > 0.1 // 90% success rate
      const executionTimeMs = Math.random() * 5000 + 1000 // 1-6 seconds

      executions.push({
        id: `exec_${workflowId}_${i}`,
        workflowId,
        status: success ? 'completed' : 'failed',
        startTime: executionTime,
        endTime: new Date(executionTime.getTime() + executionTimeMs),
        duration: executionTimeMs,
        steps: [
          { id: 'step1', duration: executionTimeMs * 0.3, status: success ? 'success' : 'failed' },
          { id: 'step2', duration: executionTimeMs * 0.4, status: success ? 'success' : 'success' },
          { id: 'step3', duration: executionTimeMs * 0.3, status: success ? 'success' : 'success' }
        ]
      })
    }

    return executions
  }

  private calculatePerformanceMetrics(workflowId: string, executions: any[]): WorkflowPerformanceMetrics {
    const executionCount = executions.length
    const successfulExecutions = executions.filter(e => e.status === 'completed')
    const successRate = executionCount > 0 ? successfulExecutions.length / executionCount : 0
    const averageExecutionTime = executionCount > 0
      ? executions.reduce((sum, e) => sum + e.duration, 0) / executionCount
      : 0
    const errorRate = 1 - successRate

    // Calculate throughput (executions per hour)
    const timeSpan = executions.length > 0
      ? (new Date().getTime() - Math.min(...executions.map(e => new Date(e.startTime).getTime()))) / (1000 * 60 * 60)
      : 1
    const throughput = executionCount / timeSpan

    // Calculate resource usage (mock data)
    const resourceUsage = {
      cpu: Math.random() * 0.8 + 0.1, // 10-90%
      memory: Math.random() * 0.7 + 0.2, // 20-90%
      network: Math.random() * 0.5 + 0.1 // 10-60%
    }

    // Identify bottleneck steps
    const stepPerformance = executions.reduce((acc, execution) => {
      execution.steps?.forEach((step: any) => {
        if (!acc[step.id]) {
          acc[step.id] = { totalDuration: 0, count: 0, failures: 0 }
        }
        acc[step.id].totalDuration += step.duration
        acc[step.id].count++
        if (step.status === 'failed') {
          acc[step.id].failures++
        }
      })
      return acc
    }, {} as Record<string, any>)

    const bottleneckSteps = Object.entries(stepPerformance)
      .map(([stepId, perf]) => ({
        stepId,
        averageDuration: perf.totalDuration / perf.count,
        failureRate: perf.failures / perf.count
      }))
      .filter(step => step.averageDuration > 2000 || step.failureRate > 0.1)
      .sort((a, b) => b.averageDuration - a.averageDuration)
      .slice(0, 3)
      .map(step => step.stepId)

    return {
      workflowId,
      executionCount,
      successRate,
      averageExecutionTime,
      errorRate,
      lastExecuted: executions.length > 0 ? new Date(Math.max(...executions.map(e => new Date(e.startTime).getTime()))) : new Date(),
      throughput,
      resourceUsage,
      bottleneckSteps
    }
  }

  private async identifyOptimizationOpportunities(metrics: WorkflowPerformanceMetrics): Promise<OptimizationOpportunity[]> {
    const opportunities: OptimizationOpportunity[] = []

    // Performance optimizations
    if (metrics.averageExecutionTime > 3000) {
      opportunities.push({
        type: 'performance',
        severity: metrics.averageExecutionTime > 6000 ? 'critical' : 'high',
        description: 'Slow workflow execution detected',
        affectedSteps: metrics.bottleneckSteps || [],
        estimatedImprovement: {
          performance: 30 + Math.random() * 40 // 30-70% improvement
        },
        suggestedChanges: [
          {
            type: 'parallel',
            description: 'Parallelize independent steps',
            target: 'workflow',
            parameters: { parallelSteps: metrics.bottleneckSteps },
            confidence: 0.8,
            reasoning: 'Steps can be executed concurrently to reduce total execution time'
          },
          {
            type: 'cache',
            description: 'Cache step results',
            target: metrics.bottleneckSteps?.[0] || 'all',
            parameters: { ttl: 3600 },
            confidence: 0.7,
            reasoning: 'Caching frequently accessed data can reduce computation time'
          }
        ],
        implementationComplexity: 'moderate'
      })
    }

    // Reliability optimizations
    if (metrics.errorRate > 0.1) {
      opportunities.push({
        type: 'reliability',
        severity: metrics.errorRate > 0.3 ? 'critical' : 'high',
        description: 'High error rate detected',
        affectedSteps: metrics.bottleneckSteps || [],
        estimatedImprovement: {
          reliability: 40 + Math.random() * 40 // 40-80% improvement
        },
        suggestedChanges: [
          {
            type: 'retry',
            description: 'Add retry logic with exponential backoff',
            target: metrics.bottleneckSteps?.[0] || 'all',
            parameters: { maxRetries: 3, backoffMultiplier: 2 },
            confidence: 0.9,
            reasoning: 'Transient failures can be resolved through automatic retries'
          },
          {
            type: 'timeout',
            description: 'Adjust timeout settings',
            target: metrics.bottleneckSteps?.[0] || 'all',
            parameters: { timeout: 30000 },
            confidence: 0.8,
            reasoning: 'Proper timeout configuration prevents premature failures'
          }
        ],
        implementationComplexity: 'simple'
      })
    }

    // Resource optimizations
    if (metrics.resourceUsage.cpu > 0.8 || metrics.resourceUsage.memory > 0.8) {
      opportunities.push({
        type: 'resource',
        severity: 'medium',
        description: 'High resource usage detected',
        affectedSteps: metrics.bottleneckSteps || [],
        estimatedImprovement: {
          cost: 20 + Math.random() * 30 // 20-50% cost reduction
        },
        suggestedChanges: [
          {
            type: 'batch',
            description: 'Process items in batches',
            target: metrics.bottleneckSteps?.[0] || 'all',
            parameters: { batchSize: 100 },
            confidence: 0.7,
            reasoning: 'Batch processing can reduce memory usage and improve throughput'
          },
          {
            type: 'resource',
            description: 'Optimize memory allocation',
            target: 'workflow',
            parameters: { maxMemory: '512MB' },
            confidence: 0.6,
            reasoning: 'Memory optimization can reduce overall resource consumption'
          }
        ],
        implementationComplexity: 'moderate'
      })
    }

    // Throughput optimizations
    if (metrics.throughput < 10) {
      opportunities.push({
        type: 'performance',
        severity: 'medium',
        description: 'Low throughput detected',
        affectedSteps: ['all'],
        estimatedImprovement: {
          performance: 50 + Math.random() * 50 // 50-100% improvement
        },
        suggestedChanges: [
          {
            type: 'parallel',
            description: 'Enable concurrent executions',
            target: 'workflow',
            parameters: { maxConcurrency: 5 },
            confidence: 0.8,
            reasoning: 'Concurrent execution can significantly improve throughput'
          }
        ],
        implementationComplexity: 'simple'
      })
    }

    return opportunities
  }

  private calculateOpportunityConfidence(opportunity: OptimizationOpportunity): number {
    // Base confidence from suggested changes
    const avgChangeConfidence = opportunity.suggestedChanges.reduce((sum, change) => sum + change.confidence, 0) / opportunity.suggestedChanges.length

    // Adjust based on severity (higher severity = higher confidence in need)
    const severityMultiplier = {
      'low': 0.7,
      'medium': 0.8,
      'high': 0.9,
      'critical': 1.0
    }[opportunity.severity]

    return avgChangeConfidence * severityMultiplier
  }

  private calculateExpectedImpact(opportunities: OptimizationOpportunity[]): {
    performance: number
    reliability: number
    cost: number
  } {
    const totalImpact = opportunities.reduce((acc, op) => ({
      performance: acc.performance + (op.estimatedImprovement.performance || 0),
      reliability: acc.reliability + (op.estimatedImprovement.reliability || 0),
      cost: acc.cost + (op.estimatedImprovement.cost || 0)
    }), { performance: 0, reliability: 0, cost: 0 })

    return {
      performance: totalImpact.performance / opportunities.length,
      reliability: totalImpact.reliability / opportunities.length,
      cost: totalImpact.cost / opportunities.length
    }
  }

  private assessRiskLevel(opportunities: OptimizationOpportunity[]): 'low' | 'medium' | 'high' {
    const complexityScores = opportunities.map(op => ({
      'simple': 1,
      'moderate': 2,
      'complex': 3
    }[op.implementationComplexity]))

    const avgComplexity = complexityScores.reduce((sum, score) => sum + score, 0) / complexityScores.length

    if (avgComplexity <= 1.5) return 'low'
    if (avgComplexity <= 2.5) return 'medium'
    return 'high'
  }

  private generateRollbackPlan(opportunities: OptimizationOpportunity[]): string {
    const steps = [
      '1. Monitor workflow performance for 24 hours after changes',
      '2. Set up alerts for error rate increase > 5%',
      '3. Prepare workflow backup with previous configuration',
      '4. Document all changes with timestamps and parameters',
      '5. Create rollback script to revert specific changes'
    ]

    return steps.join('\n')
  }

  private getRiskScore(riskLevel: string): number {
    const scores = {
      'low': 0.1,
      'medium': 0.3,
      'high': 0.6
    }
    return scores[riskLevel as keyof typeof scores] || 0.5
  }

  private getSeverityScore(severity: string): number {
    const scores = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'critical': 4
    }
    return scores[severity as keyof typeof scores] || 1
  }

  private async applyOpportunity(workflowId: string, opportunity: OptimizationOpportunity): Promise<void> {
    // This would integrate with the actual workflow engine
    // For now, simulate the application
    for (const change of opportunity.suggestedChanges) {
      console.log(`[WorkflowOptimizer] Applying ${change.type} to ${change.target} in workflow ${workflowId}`)

      // Simulate API call to workflow engine
      await new Promise(resolve => setTimeout(resolve, 100))

      // Track the application
      analytics.track({
        type: 'system_event' as any,
        category: 'monitoring' as any,
        action: 'optimization_change_applied',
        properties: {
          workflowId,
          changeType: change.type,
          target: change.target,
          confidence: change.confidence
        }
      })
    }
  }

  private async loadOptimizationHistory(): Promise<void> {
    try {
      // Load from Blink database or local storage
      if (blink.db.optimizationHistory) {
        const history = await blink.db.optimizationHistory.findMany()
        history.forEach(item => {
          const workflowId = item.workflowId
          if (!this.optimizationHistory.has(workflowId)) {
            this.optimizationHistory.set(workflowId, [])
          }
          this.optimizationHistory.get(workflowId)!.push(item)
        })
      }
    } catch (error) {
      console.error('Failed to load optimization history:', error)
    }
  }

  private startPeriodicOptimization(): void {
    const frequencies = {
      'hourly': 60 * 60 * 1000,
      'daily': 24 * 60 * 60 * 1000,
      'weekly': 7 * 24 * 60 * 60 * 1000
    }

    const interval = frequencies[this.config.optimizationFrequency]

    setInterval(async () => {
      try {
        await this.runOptimizationCycle()
      } catch (error) {
        console.error('Optimization cycle failed:', error)
      }
    }, interval)
  }

  private async runOptimizationCycle(): Promise<void> {
    console.log('[WorkflowOptimizer] Starting optimization cycle')

    const insights = await this.getOptimizationInsights()
    const workflowIds = insights.workflowMetrics.map(wm => wm.workflowId)

    for (const workflowId of workflowIds) {
      try {
        const recommendations = await this.generateRecommendations(workflowId)

        if (this.config.autoApply && recommendations.riskLevel === 'low') {
          await this.applyRecommendation(recommendations.id, true)
        }
      } catch (error) {
        console.warn(`[WorkflowOptimizer] Failed to optimize workflow ${workflowId}:`, error)
      }
    }

    console.log('[WorkflowOptimizer] Optimization cycle completed')
  }

  private async getAllWorkflowIds(): Promise<string[]> {
    // This would query from the actual workflow registry
    // For now, return mock workflow IDs
    return ['workflow_1', 'workflow_2', 'workflow_3', 'workflow_4', 'workflow_5']
  }

  private generateRecommendationId(): string {
    return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private async storeRecommendation(recommendation: OptimizationRecommendation): Promise<void> {
    try {
      // Store in Blink database
      if (blink.db.optimizationRecommendations) {
        await blink.db.optimizationRecommendations.create({
          ...recommendation,
          createdAt: recommendation.createdAt.toISOString()
        })
      }

      // Update in-memory history
      if (!this.optimizationHistory.has(recommendation.workflowId)) {
        this.optimizationHistory.set(recommendation.workflowId, [])
      }
      this.optimizationHistory.get(recommendation.workflowId)!.push(recommendation)
    } catch (error) {
      console.error('Failed to store recommendation:', error)
    }
  }

  private async getRecommendation(recommendationId: string): Promise<OptimizationRecommendation | null> {
    try {
      // Query from Blink database
      if (blink.db.optimizationRecommendations) {
        const recommendation = await blink.db.optimizationRecommendations.findFirst({
          where: { id: recommendationId }
        })
        return recommendation
      }
      return null
    } catch (error) {
      console.error('Failed to get recommendation:', error)
      return null
    }
  }

  private async updateRecommendation(recommendation: OptimizationRecommendation): Promise<void> {
    try {
      // Update in Blink database
      if (blink.db.optimizationRecommendations) {
        await blink.db.optimizationRecommendations.update(recommendation.id, {
          status: recommendation.status,
          appliedAt: recommendation.appliedAt?.toISOString()
        })
      }
    } catch (error) {
      console.error('Failed to update recommendation:', error)
    }
  }
}

// Export singleton instance
export const workflowOptimizer = new WorkflowOptimizer()

// Export types
export type { AutoTuningConfig, WorkflowPerformanceMetrics, OptimizationOpportunity, OptimizationRecommendation }