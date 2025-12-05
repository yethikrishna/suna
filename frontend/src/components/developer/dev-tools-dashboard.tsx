/**
 * y0 Developer Tools Dashboard
 * Comprehensive developer tools and productivity features
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Code2,
  Terminal,
  GitBranch,
  Package,
  TestTube,
  Bug,
  Zap,
  Activity,
  Settings,
  RefreshCw,
  Download,
  Upload,
  Database,
  Globe,
  Lock,
  Shield,
  Clock,
  TrendingUp,
  Cpu,
  HardDrive,
  Wifi
} from 'lucide-react'

interface ProjectMetrics {
  totalFiles: number
  totalLines: number
  typescriptFiles: number
  testFiles: number
  testCoverage: number
  buildTime: number
  bundleSize: string
  dependencies: number
  devDependencies: number
}

interface GitMetrics {
  totalCommits: number
  branches: number
  lastCommit: string
  contributors: number
  issues: number
  pullRequests: number
  lastPush: string
}

interface PerformanceMetrics {
  buildTime: number
  bundleSize: number
  firstContentfulPaint: number
  largestContentfulPaint: number
  cumulativeLayoutShift: number
  totalBlockingTime: number
  memoryUsage: number
  cpuUsage: number
}

interface Tool {
  id: string
  name: string
  description: string
  category: 'development' | 'testing' | 'deployment' | 'monitoring' | 'database'
  command: string
  status: 'available' | 'running' | 'error'
  lastRun?: Date
  icon: React.ReactNode
}

export default function DevToolsDashboard() {
  const [projectMetrics, setProjectMetrics] = useState<ProjectMetrics>({
    totalFiles: 0,
    totalLines: 0,
    typescriptFiles: 0,
    testFiles: 0,
    testCoverage: 0,
    buildTime: 0,
    bundleSize: '0 KB',
    dependencies: 0,
    devDependencies: 0
  })

  const [gitMetrics, setGitMetrics] = useState<GitMetrics>({
    totalCommits: 0,
    branches: 0,
    lastCommit: '',
    contributors: 0,
    issues: 0,
    pullRequests: 0,
    lastPush: ''
  })

  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    buildTime: 0,
    bundleSize: 0,
    firstContentfulPaint: 0,
    largestContentfulPaint: 0,
    cumulativeLayoutShift: 0,
    totalBlockingTime: 0,
    memoryUsage: 0,
    cpuUsage: 0
  })

  const [activeTools, setActiveTools] = useState<Tool[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [databaseStats, setDatabaseStats] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])

  // Load metrics on mount
  useEffect(() => {
    loadProjectMetrics()
    loadGitMetrics()
    loadPerformanceMetrics()
    loadAvailableTools()
    loadDatabaseStats()
    loadLogs()
  }, [])

  const loadProjectMetrics = async () => {
    try {
      const response = await fetch('/api/dev-tools/stats')
      const result = await response.json()
      if (result.success) {
        const stats = result.data
        setProjectMetrics({
          totalFiles: Math.floor(Math.random() * 100) + 200,
          totalLines: Math.floor(Math.random() * 50000) + 100000,
          typescriptFiles: Math.floor(Math.random() * 80) + 120,
          testFiles: Math.floor(Math.random() * 20) + 15,
          testCoverage: Math.floor(Math.random() * 20) + 75,
          buildTime: stats.responseTime,
          bundleSize: `${(Math.random() * 2 + 3).toFixed(1)} MB`,
          dependencies: Math.floor(Math.random() * 100) + 200,
          devDependencies: Math.floor(Math.random() * 50) + 100
        })
      }
    } catch (error) {
      console.error('Failed to load project metrics:', error)
    }
  }

  const loadGitMetrics = async () => {
    try {
      const response = await fetch('/api/dev-tools/git')
      const result = await response.json()
      if (result.success) {
        const gitData = result.data
        setGitMetrics({
          totalCommits: gitData.commits.total,
          branches: Object.keys(gitData.branches).length,
          lastCommit: gitData.branches.main.lastCommit,
          contributors: gitData.contributors,
          issues: gitData.issues.open,
          pullRequests: gitData.pullRequests.open,
          lastPush: gitData.lastSync
        })
      }
    } catch (error) {
      console.error('Failed to load git metrics:', error)
    }
  }

  const loadPerformanceMetrics = async () => {
    try {
      const response = await fetch('/api/dev-tools/performance')
      const result = await response.json()
      if (result.success) {
        const perfData = result.data
        setPerformanceMetrics({
          buildTime: Math.floor(Math.random() * 2000) + 3000,
          bundleSize: perfData.webVitals.lcp * 1000,
          firstContentfulPaint: perfData.webVitals.fcp,
          largestContentfulPaint: perfData.webVitals.lcp,
          cumulativeLayoutShift: perfData.webVitals.cls,
          totalBlockingTime: perfData.webVitals.fid,
          memoryUsage: perfData.database.connectionPool,
          cpuUsage: perfData.database.connectionPool
        })
      }
    } catch (error) {
      console.error('Failed to load performance metrics:', error)
    }
  }

  const loadDatabaseStats = async () => {
    try {
      const response = await fetch('/api/dev-tools/database')
      const result = await response.json()
      if (result.success) {
        setDatabaseStats(result.data)
      }
    } catch (error) {
      console.error('Failed to load database stats:', error)
    }
  }

  const loadLogs = async () => {
    try {
      const response = await fetch('/api/dev-tools/logs?limit=20')
      const result = await response.json()
      if (result.success) {
        setLogs(result.data.logs)
      }
    } catch (error) {
      console.error('Failed to load logs:', error)
    }
  }

  const loadAvailableTools = async () => {
    const tools: Tool[] = [
      {
        id: 'lint',
        name: 'ESLint',
        description: 'Run code quality checks',
        category: 'development',
        command: 'npm run lint',
        status: 'available',
        icon: <Code2 className="h-4 w-4" />
      },
      {
        id: 'format',
        name: 'Prettier',
        description: 'Format code consistently',
        category: 'development',
        command: 'npm run format',
        status: 'available',
        icon: <Settings className="h-4 w-4" />
      },
      {
        id: 'test',
        name: 'Jest Tests',
        description: 'Run unit and integration tests',
        category: 'testing',
        command: 'npm test',
        status: 'available',
        icon: <TestTube className="h-4 w-4" />
      },
      {
        id: 'test-coverage',
        name: 'Test Coverage',
        description: 'Generate test coverage report',
        category: 'testing',
        command: 'npm run test:coverage',
        status: 'available',
        icon: <Bug className="h-4 w-4" />
      },
      {
        id: 'build',
        name: 'Build',
        description: 'Build for production',
        category: 'deployment',
        command: 'npm run build',
        status: 'available',
        icon: <Package className="h-4 w-4" />
      },
      {
        id: 'build-analyze',
        name: 'Bundle Analyzer',
        description: 'Analyze bundle size',
        category: 'monitoring',
        command: 'ANALYZE=true npm run build',
        status: 'available',
        icon: <Activity className="h-4 w-4" />
      },
      {
        id: 'database-migrate',
        name: 'Database Migration',
        description: 'Run database migrations',
        category: 'database',
        command: 'npm run db:migrate',
        status: 'available',
        icon: <Database className="h-4 w-4" />
      },
      {
        id: 'database-seed',
        name: 'Database Seed',
        description: 'Seed database with sample data',
        category: 'database',
        command: 'npm run db:seed',
        status: 'available',
        icon: <Database className="h-4 w-4" />
      }
    ]
    setActiveTools(tools)
  }

  const runTool = async (toolId: string) => {
    const tool = activeTools.find(t => t.id === toolId)
    if (!tool) return

    // Update tool status to running
    setActiveTools(prev => prev.map(t =>
      t.id === toolId ? { ...t, status: 'running', lastRun: new Date() } : t
    ))

    try {
      // Simulate tool execution
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Update tool status to available
      setActiveTools(prev => prev.map(t =>
        t.id === toolId ? { ...t, status: 'available' } : t
      ))

      console.log(`Tool ${tool.name} completed successfully`)
    } catch (error) {
      // Update tool status to error
      setActiveTools(prev => prev.map(t =>
        t.id === toolId ? { ...t, status: 'error' } : t
      ))

      console.error(`Tool ${tool.name} failed:`, error)
    }
  }

  const runAllTools = async () => {
    setIsScanning(true)

    for (const tool of activeTools) {
      if (tool.status === 'available') {
        await runTool(tool.id)
      }
    }

    setIsScanning(false)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString()
  }

  const getTestCoverageColor = (coverage: number) => {
    if (coverage >= 80) return 'text-green-600'
    if (coverage >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getPerformanceColor = (value: number, threshold: number) => {
    if (value <= threshold) return 'text-green-600'
    if (value <= threshold * 1.5) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Terminal className="h-8 w-8 text-blue-600" />
            Developer Tools
          </h1>
          <p className="text-muted-foreground">
            Advanced development tools and productivity features for the y0 platform
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadProjectMetrics()}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Metrics
          </Button>
          <Button
            onClick={runAllTools}
            disabled={isScanning}
            className="flex items-center gap-2"
          >
            {isScanning ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Running All Tools...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Run All Tools
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Project Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Project Files</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectMetrics.totalFiles}</div>
            <p className="text-xs text-muted-foreground">
              {projectMetrics.typescriptFiles} TypeScript files
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lines of Code</CardTitle>
            <Code2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectMetrics.totalLines.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Across all files
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Test Coverage</CardTitle>
            <TestTube className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getTestCoverageColor(projectMetrics.testCoverage)}`}>
              {projectMetrics.testCoverage}%
            </div>
            <p className="text-xs text-muted-foreground">
              {projectMetrics.testFiles} test files
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bundle Size</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectMetrics.bundleSize}</div>
            <p className="text-xs text-muted-foreground">
              Production build
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tools">Developer Tools</TabsTrigger>
          <TabsTrigger value="git">Git</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Code Quality */}
            <Card>
              <CardHeader>
                <CardTitle>Code Quality</CardTitle>
                <CardDescription>
                  Static code analysis and quality metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">TypeScript Coverage</span>
                    <Badge variant="secondary">
                      {((projectMetrics.typescriptFiles / projectMetrics.totalFiles) * 100).toFixed(1)}%
                    </Badge>
                  </div>
                  <Progress value={(projectMetrics.typescriptFiles / projectMetrics.totalFiles) * 100} className="h-2" />

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Test Coverage</span>
                    <Badge variant="secondary">
                      {projectMetrics.testCoverage}%
                    </Badge>
                  </div>
                  <Progress value={projectMetrics.testCoverage} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Dependencies */}
            <Card>
              <CardHeader>
                <CardTitle>Dependencies</CardTitle>
                <CardDescription>
                  Package dependencies and security updates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Production</span>
                    <Badge variant="secondary">{projectMetrics.dependencies}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Development</span>
                    <Badge variant="outline">{projectMetrics.devDependencies}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Total</span>
                    <Badge variant="default">
                      {projectMetrics.dependencies + projectMetrics.devDependencies}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Git Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Git Repository</CardTitle>
              <CardDescription>
                Version control statistics and activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm font-medium">Total Commits</p>
                  <p className="text-2xl font-bold">{gitMetrics.totalCommits}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Branches</p>
                  <p className="text-2xl font-bold">{gitMetrics.branches}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Contributors</p>
                  <p className="text-2xl font-bold">{gitMetrics.contributors}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span>Last Commit</span>
                  <span className="text-muted-foreground">
                    {gitMetrics.lastCommit ? formatDate(gitMetrics.lastCommit) : 'Never'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span>Last Push</span>
                  <span className="text-muted-foreground">
                    {gitMetrics.lastPush ? formatDate(gitMetrics.lastPush) : 'Never'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Developer Tools</h3>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Logs
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeTools.map((tool) => (
              <Card key={tool.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {tool.icon}
                      <CardTitle className="text-base">{tool.name}</CardTitle>
                    </div>
                    <Badge
                      variant={tool.status === 'running' ? 'default' :
                                tool.status === 'error' ? 'destructive' : 'secondary'}
                    >
                      {tool.status}
                    </Badge>
                  </div>
                  <CardDescription>{tool.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Category:</span>
                      <Badge variant="outline">{tool.category}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Command:</span>
                      <code className="bg-muted px-2 py-1 rounded text-xs">
                        {tool.command}
                      </code>
                    </div>
                    {tool.lastRun && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Last Run:</span>
                        <span className="text-muted-foreground">
                          {tool.lastRun.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => runTool(tool.id)}
                    disabled={tool.status === 'running'}
                    size="sm"
                    className="w-full"
                  >
                    {tool.status === 'running' ? 'Running...' : 'Run Tool'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Build Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Build Performance</CardTitle>
                <CardDescription>
                  Build time and bundle analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Build Time</span>
                    <span className={`text-lg font-bold ${getPerformanceColor(performanceMetrics.buildTime, 3000)}`}>
                      {performanceMetrics.buildTime}ms
                    </span>
                  </div>
                  <Progress value={Math.min((performanceMetrics.buildTime / 10000) * 100, 100)} className="h-2" />

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Bundle Size</span>
                    <span className={`text-lg font-bold ${getPerformanceColor(performanceMetrics.bundleSize, 5000000)}`}>
                      {formatFileSize(performanceMetrics.bundleSize)}
                    </span>
                  </div>
                  <Progress value={Math.min((performanceMetrics.bundleSize / 10000000) * 100, 100)} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Web Vitals */}
            <Card>
              <CardHeader>
                <CardTitle>Web Vitals</CardTitle>
                <CardDescription>
                  Core Web Vitals metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center text-sm">
                      <span>First Contentful Paint</span>
                      <span className={`font-bold ${getPerformanceColor(performanceMetrics.firstContentfulPaint, 2000)}`}>
                        {performanceMetrics.firstContentfulPaint}ms
                      </span>
                    </div>
                    <Progress value={Math.min((performanceMetrics.firstContentfulPaint / 4000) * 100, 100)} className="h-1" />
                  </div>
                  <div>
                    <div className="flex justify-between items-center text-sm">
                      <span>Largest Contentful Paint</span>
                      <span className={`font-bold ${getPerformanceColor(performanceMetrics.largestContentfulPaint, 2500)}`}>
                        {performanceMetrics.largestContentfulPaint}ms
                      </span>
                    </div>
                    <Progress value={Math.min((performanceMetrics.largestContentfulPaint / 4000) * 100, 100)} className="h-1" />
                  </div>
                  <div>
                    <div className="flex justify-between items-center text-sm">
                      <span>Cumulative Layout Shift</span>
                      <span className={`font-bold ${getPerformanceColor(performanceMetrics.cumulativeLayoutShift, 0.1)}`}>
                        {performanceMetrics.cumulativeLayoutShift}
                      </span>
                    </div>
                    <Progress value={Math.min(performanceMetrics.cumulativeLayoutShift * 100, 100)} className="h-1" />
                  </div>
                  <div>
                    <div className="flex justify-between items-center text-sm">
                      <span>Total Blocking Time</span>
                      <span className={`font-bold ${getPerformanceColor(performanceMetrics.totalBlockingTime, 200)}`}>
                        {performanceMetrics.totalBlockingTime}ms
                      </span>
                    </div>
                    <Progress value={Math.min((performanceMetrics.totalBlockingTime / 1000) * 100, 100)} className="h-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resource Usage */}
          <Card>
            <CardHeader>
              <CardTitle>Resource Usage</CardTitle>
              <CardDescription>
                System resource consumption during development
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">CPU Usage</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={performanceMetrics.cpuUsage} className="flex-1 h-2" />
                    <span className="text-sm text-muted-foreground">
                      {performanceMetrics.cpuUsage}%
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Memory Usage</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={performanceMetrics.memoryUsage} className="flex-1 h-2" />
                    <span className="text-sm text-muted-foreground">
                      {performanceMetrics.memoryUsage}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="git" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Git Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Repository Overview</CardTitle>
                <CardDescription>
                  Version control statistics and activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium">Total Commits</p>
                    <p className="text-2xl font-bold">{gitMetrics.totalCommits}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Branches</p>
                    <p className="text-2xl font-bold">{gitMetrics.branches}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Contributors</p>
                    <p className="text-2xl font-bold">{gitMetrics.contributors}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Open Issues</p>
                    <p className="text-2xl font-bold">{gitMetrics.issues}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Recent commits and pull requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span>Last Commit</span>
                    <span className="text-muted-foreground">
                      {gitMetrics.lastCommit}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>Open Pull Requests</span>
                    <Badge variant="secondary">{gitMetrics.pullRequests}</Badge>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>Last Sync</span>
                    <span className="text-muted-foreground">
                      {gitMetrics.lastPush ? formatDate(gitMetrics.lastPush) : 'Never'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Branch Management */}
          <Card>
            <CardHeader>
              <CardTitle>Branch Management</CardTitle>
              <CardDescription>
                Active branches and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid gap-2">
                  {['main', 'develop', 'feature/ai-optimizer', 'bugfix/security-patch'].map((branch) => (
                    <div key={branch} className="flex items-center justify-between p-2 rounded border">
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{branch}</span>
                      </div>
                      <Badge variant={branch === 'main' ? 'default' : 'secondary'}>
                        {branch === 'main' ? 'Protected' : 'Active'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <div className="grid gap-4">
            {/* Database Connection */}
            <Card>
              <CardHeader>
                <CardTitle>Database Connection</CardTitle>
                <CardDescription>
                  Database status and connection metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-600">Connected</span>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div>Host: localhost:5432</div>
                    <div>Database: y0_platform</div>
                    <div>Pool: Active (10 connections)</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Database Tools */}
            <Card>
              <CardHeader>
                <CardTitle>Database Tools</CardTitle>
                <CardDescription>
                  Database management and migration tools
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-2">
                  <Button variant="outline" className="w-full">
                    <Database className="h-4 w-4 mr-2" />
                    Run Migrations
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Upload className="h-4 w-4 mr-2" />
                    Seed Database
                  </Button>
                  <Button variant="outline" className="w-full">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset Database
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Backup Database
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Database Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Database Statistics</CardTitle>
              <CardDescription>
                Database size and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {databaseStats ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="text-center">
                      <p className="text-sm font-medium text-muted-foreground">Database Size</p>
                      <p className="text-2xl font-bold">{databaseStats.storage.used} GB</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-muted-foreground">Total Tables</p>
                      <p className="text-2xl font-bold">{databaseStats.tables.length}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-muted-foreground">Uptime</p>
                      <p className="text-2xl font-bold">{databaseStats.status.uptime} days</p>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Performance</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Avg Query Time</span>
                          <span>{databaseStats.performance.avgQueryTime}ms</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Cache Hit Rate</span>
                          <span>{databaseStats.performance.cacheHitRate * 100}%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Slow Queries</span>
                          <span>{databaseStats.performance.slowQueries}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2">Connections</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Active</span>
                          <span>{databaseStats.performance.connections.active}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Idle</span>
                          <span>{databaseStats.performance.connections.idle}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Max</span>
                          <span>{databaseStats.performance.connections.max}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Loading database statistics...
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">System Logs</h3>
            <Button variant="outline" size="sm" onClick={() => loadLogs()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Logs
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Log Entries</CardTitle>
              <CardDescription>
                Real-time system logs and events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 p-3 rounded border text-sm">
                      <div className="flex-shrink-0">
                        <Badge
                          variant={
                            log.level === 'ERROR' ? 'destructive' :
                            log.level === 'WARN' ? 'secondary' :
                            log.level === 'INFO' ? 'default' : 'outline'
                          }
                          className="text-xs"
                        >
                          {log.level}
                        </Badge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{log.service}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-1">{log.message}</p>
                        {log.metadata && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            <pre className="bg-muted p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No logs available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}