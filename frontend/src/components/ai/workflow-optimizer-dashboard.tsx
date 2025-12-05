/**
 * y0 Workflow Optimizer Dashboard
 * AI-powered workflow optimization and monitoring dashboard
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Radar
} from 'recharts'
import {
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Target,
  Settings,
  Play,
  Pause,
  RefreshCw,
  BarChart3,
  Brain,
  Shield,
  DollarSign,
  Gauge
} from 'lucide-react'
import { workflowOptimizer, OptimizationRecommendation, WorkflowPerformanceMetrics } from '@/lib/ai/workflow-optimizer'
import { useAnalyticsQuery } from '@/hooks/use-analytics'

interface WorkflowOptimizerDashboardProps {
  workflowIds?: string[]
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#ff0000', '#00cccc', '#ff00ff']

export default function WorkflowOptimizerDashboard({ workflowIds }: WorkflowOptimizerDashboardProps) {
  const [insights, setInsights] = useState<any>(null)
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [autoTuningEnabled, setAutoTuningEnabled] = useState(false)

  // Load optimization insights
  useEffect(() => {
    loadOptimizationInsights()
  }, [workflowIds])

  const loadOptimizationInsights = async () => {
    try {
      const data = await workflowOptimizer.getOptimizationInsights(workflowIds)
      setInsights(data)
    } catch (error) {
      console.error('Failed to load optimization insights:', error)
    }
  }

  const analyzeWorkflow = async (workflowId: string) => {
    setIsAnalyzing(true)
    try {
      const metrics = await workflowOptimizer.analyzeWorkflow(workflowId)
      console.log('Workflow analysis completed:', metrics)
    } catch (error) {
      console.error('Workflow analysis failed:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const generateRecommendations = async (workflowId: string) => {
    try {
      const recommendation = await workflowOptimizer.generateRecommendations(workflowId)
      setRecommendations(prev => [...prev, recommendation])
    } catch (error) {
      console.error('Failed to generate recommendations:', error)
    }
  }

  const applyRecommendation = async (recommendationId: string) => {
    setIsApplying(true)
    try {
      const success = await workflowOptimizer.applyRecommendation(recommendationId)
      if (success) {
        setRecommendations(prev => prev.map(rec =>
          rec.id === recommendationId ? { ...rec, status: 'applied' as const } : rec
        ))
        await loadOptimizationInsights() // Refresh insights
      }
    } catch (error) {
      console.error('Failed to apply recommendation:', error)
    } finally {
      setIsApplying(false)
    }
  }

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'applied': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-blue-100 text-blue-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'rejected': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return '#22c55e'
      case 'medium': return '#eab308'
      case 'high': return '#f97316'
      case 'critical': return '#ef4444'
      default: return '#8884d8'
    }
  }

  const performanceData = insights?.workflowMetrics?.map((wm: WorkflowPerformanceMetrics) => ({
    name: wm.workflowId,
    successRate: wm.successRate * 100,
    avgExecutionTime: wm.averageExecutionTime / 1000, // Convert to seconds
    throughput: wm.throughput,
    errorRate: wm.errorRate * 100
  })) || []

  const riskDistributionData = Object.entries(insights?.riskDistribution || {}).map(([risk, count]) => ({
    name: risk,
    value: count,
    color: getRiskColor(risk)
  }))

  const optimizationTypesData = insights?.topOptimizationTypes || []

  const radarData = insights?.workflowMetrics?.slice(0, 5).map((wm: WorkflowPerformanceMetrics) => ({
    workflow: wm.workflowId,
    performance: 100 - (wm.averageExecutionTime / 100), // Inverse so lower time = higher score
    reliability: wm.successRate * 100,
    efficiency: Math.min(wm.throughput * 10, 100), // Scale throughput
    resourceUsage: (1 - wm.resourceUsage.cpu) * 100 // Inverse so lower usage = higher score
  })) || []

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-8 w-8 text-blue-600" />
            AI Workflow Optimizer
          </h1>
          <p className="text-muted-foreground">
            Intelligent workflow optimization and performance tuning powered by AI
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={autoTuningEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoTuningEnabled(!autoTuningEnabled)}
            className="flex items-center gap-2"
          >
            {autoTuningEnabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            Auto-Tuning: {autoTuningEnabled ? 'On' : 'Off'}
          </Button>

          <Button variant="outline" size="sm" onClick={loadOptimizationInsights}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Optimizations</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights?.totalOptimizations || 0}</div>
            <p className="text-xs text-muted-foreground">
              Available improvements
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Impact</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights?.highImpactOpportunities || 0}</div>
            <p className="text-xs text-muted-foreground">
              Critical opportunities
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Improvement</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(insights?.averageImprovementPotential || 0)}%</div>
            <p className="text-xs text-muted-foreground">
              Expected performance gain
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workflows</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights?.workflowMetrics?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Analyzed workflows
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Workflow Performance</CardTitle>
                <CardDescription>
                  Success rate and execution time comparison
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="successRate" fill="#8884d8" name="Success Rate (%)" />
                    <Bar dataKey="throughput" fill="#82ca9d" name="Throughput" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Risk Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Risk Distribution</CardTitle>
                <CardDescription>
                  Optimization opportunities by risk level
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
                      {riskDistributionData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Radar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Workflow Health Overview</CardTitle>
              <CardDescription>
                Multi-dimensional performance analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="workflow" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar name="Performance" dataKey="performance" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                  <Radar name="Reliability" dataKey="reliability" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.3} />
                  <Radar name="Efficiency" dataKey="efficiency" stroke="#ffc658" fill="#ffc658" fillOpacity={0.3} />
                  <Radar name="Resource Usage" dataKey="resourceUsage" stroke="#ff7300" fill="#ff7300" fillOpacity={0.3} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4">
          <div className="grid gap-4">
            {insights?.workflowMetrics?.map((metrics: WorkflowPerformanceMetrics, index: number) => (
              <Card key={metrics.workflowId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        {metrics.workflowId}
                      </CardTitle>
                      <CardDescription>
                        Last executed: {metrics.lastExecuted.toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => analyzeWorkflow(metrics.workflowId)}
                        disabled={isAnalyzing}
                      >
                        {isAnalyzing ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <BarChart3 className="h-4 w-4" />
                        )}
                        Analyze
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateRecommendations(metrics.workflowId)}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Optimize
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                      <p className="text-2xl font-bold text-green-600">
                        {Math.round(metrics.successRate * 100)}%
                      </p>
                      <Progress value={metrics.successRate * 100} className="mt-1" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avg Execution</p>
                      <p className="text-2xl font-bold">
                        {Math.round(metrics.averageExecutionTime / 1000)}s
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {metrics.executionCount} executions
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Throughput</p>
                      <p className="text-2xl font-bold">
                        {Math.round(metrics.throughput)}
                      </p>
                      <p className="text-xs text-muted-foreground">per hour</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Resource Usage</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>CPU</span>
                          <span>{Math.round(metrics.resourceUsage.cpu * 100)}%</span>
                        </div>
                        <Progress value={metrics.resourceUsage.cpu * 100} className="h-1" />
                        <div className="flex justify-between text-xs">
                          <span>Memory</span>
                          <span>{Math.round(metrics.resourceUsage.memory * 100)}%</span>
                        </div>
                        <Progress value={metrics.resourceUsage.memory * 100} className="h-1" />
                      </div>
                    </div>
                  </div>

                  {metrics.bottleneckSteps && metrics.bottleneckSteps.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Bottleneck Steps</p>
                      <div className="flex gap-2 flex-wrap">
                        {metrics.bottleneckSteps.map((step, i) => (
                          <Badge key={i} variant="destructive">
                            {step}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <div className="grid gap-4">
            {recommendations.map((recommendation) => (
              <Card key={recommendation.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5" />
                        Recommendations for {recommendation.workflowId}
                      </CardTitle>
                      <CardDescription>
                        Generated on {recommendation.createdAt.toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge className={getRiskColor(recommendation.riskLevel)}>
                        Risk: {recommendation.riskLevel}
                      </Badge>
                      <Badge className={getStatusColor(recommendation.status)}>
                        {recommendation.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Expected Impact */}
                    <div>
                      <h4 className="text-sm font-medium mb-2">Expected Impact</h4>
                      <div className="grid gap-2 md:grid-cols-3">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-blue-600" />
                          <span className="text-sm">Performance: +{Math.round(recommendation.expectedImpact.performance)}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-green-600" />
                          <span className="text-sm">Reliability: +{Math.round(recommendation.expectedImpact.reliability)}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-yellow-600" />
                          <span className="text-sm">Cost: -{Math.round(recommendation.expectedImpact.cost)}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Optimization Opportunities */}
                    <div>
                      <h4 className="text-sm font-medium mb-2">Optimization Opportunities</h4>
                      <div className="space-y-3">
                        {recommendation.opportunities.map((opportunity, i) => (
                          <div key={i} className="border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-medium">{opportunity.description}</h5>
                              <Badge
                                variant="outline"
                                style={{ borderColor: getSeverityColor(opportunity.severity), color: getSeverityColor(opportunity.severity) }}
                              >
                                {opportunity.severity}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              Type: {opportunity.type} | Complexity: {opportunity.implementationComplexity}
                            </p>
                            <div className="space-y-1">
                              {opportunity.suggestedChanges.map((change, j) => (
                                <div key={j} className="flex items-start gap-2 text-sm">
                                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5" />
                                  <div>
                                    <span className="font-medium">{change.type}:</span> {change.description}
                                    <div className="text-xs text-muted-foreground">
                                      Confidence: {Math.round(change.confidence * 100)}% | {change.reasoning}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        onClick={() => applyRecommendation(recommendation.id)}
                        disabled={recommendation.status !== 'pending' || isApplying}
                        className="flex items-center gap-2"
                      >
                        {isApplying ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Zap className="h-4 w-4" />
                        )}
                        Apply Optimizations
                      </Button>
                      <Button variant="outline">
                        Review in Detail
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {recommendations.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Brain className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Recommendations Available</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Generate recommendations for workflows to see optimization opportunities here.
                  </p>
                  <Button onClick={() => loadOptimizationInsights()}>
                    Analyze All Workflows
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Optimization Types */}
            <Card>
              <CardHeader>
                <CardTitle>Optimization Types</CardTitle>
                <CardDescription>
                  Most common optimization opportunities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {optimizationTypesData.map((type: any, index: number) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{type.type}</span>
                      <Badge variant="secondary">{type.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Auto-Tuning Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Auto-Tuning Configuration</CardTitle>
                <CardDescription>
                  AI-powered optimization settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Auto-Tuning</span>
                    <Button
                      variant={autoTuningEnabled ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAutoTuningEnabled(!autoTuningEnabled)}
                    >
                      {autoTuningEnabled ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Risk Threshold</span>
                    <Badge variant="outline">30%</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Minimum Confidence</span>
                    <Badge variant="outline">80%</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Optimization Frequency</span>
                    <Badge variant="outline">Daily</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Monitor Mode</span>
                    <Badge variant="outline">Active</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Performance Insights
              </CardTitle>
              <CardDescription>
                Intelligent analysis and recommendations from the AI optimizer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    Performance Opportunities
                  </h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• 3 workflows show significant execution time improvements possible</li>
                    <li>• Parallel processing could reduce average time by 45%</li>
                    <li>• Caching strategies identified for data-intensive workflows</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-600" />
                    Reliability Enhancements
                  </h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• 2 workflows with error rates above 10% detected</li>
                    <li>• Retry logic recommended for external API calls</li>
                    <li>• Timeout adjustments could improve completion rates</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-yellow-600" />
                    Cost Optimization
                  </h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Resource usage optimization could reduce costs by 25%</li>
                    <li>• Batch processing opportunities identified</li>
                    <li>• Memory optimization recommendations available</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-purple-600" />
                    System Health
                  </h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Overall system health score: 87%</li>
                    <li>• No critical bottlenecks detected</li>
                    <li>• Resource utilization within optimal range</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}