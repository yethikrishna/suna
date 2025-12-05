'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Terminal,
  GitBranch,
  Zap,
  Database,
  Code,
  FileText,
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  Package,
  Settings,
  Play,
  Download,
  ExternalLink
} from 'lucide-react';

interface ProjectStats {
  files: number;
  linesOfCode: number;
  dependencies: number;
  testCoverage: number;
}

interface GitStats {
  commits: number;
  branches: number;
  pullRequests: number;
  lastCommit: string;
}

interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  memoryUsage: number;
}

interface DevTool {
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'error';
  version: string;
  lastUsed: string;
}

export function DevToolsDashboard() {
  const [projectStats, setProjectStats] = useState<ProjectStats>({
    files: 0,
    linesOfCode: 0,
    dependencies: 0,
    testCoverage: 0
  });

  const [gitStats, setGitStats] = useState<GitStats>({
    commits: 0,
    branches: 0,
    pullRequests: 0,
    lastCommit: ''
  });

  const [performance, setPerformance] = useState<PerformanceMetrics>({
    responseTime: 0,
    throughput: 0,
    errorRate: 0,
    memoryUsage: 0
  });

  const [devTools, setDevTools] = useState<DevTool[]>([
    {
      name: 'y0 CLI',
      description: 'Command-line interface for project management',
      status: 'active',
      version: '1.0.0',
      lastUsed: '2 hours ago'
    },
    {
      name: 'Code Generator',
      description: 'AI-powered code generation and templates',
      status: 'active',
      version: '1.2.0',
      lastUsed: '1 day ago'
    },
    {
      name: 'Performance Profiler',
      description: 'Real-time performance monitoring',
      status: 'active',
      version: '2.1.0',
      lastUsed: '5 minutes ago'
    },
    {
      name: 'Database Manager',
      description: 'Database administration and migrations',
      status: 'inactive',
      version: '1.5.0',
      lastUsed: '3 days ago'
    }
  ]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDevToolsData();
  }, []);

  const fetchDevToolsData = async () => {
    try {
      // Fetch project stats
      const statsResponse = await fetch('/api/dev-tools/stats');
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        setProjectStats(stats);
      }

      // Fetch git stats
      const gitResponse = await fetch('/api/dev-tools/git');
      if (gitResponse.ok) {
        const git = await gitResponse.json();
        setGitStats(git);
      }

      // Fetch performance metrics
      const perfResponse = await fetch('/api/dev-tools/performance');
      if (perfResponse.ok) {
        const perf = await perfResponse.json();
        setPerformance(perf);
      }
    } catch (error) {
      console.error('Failed to fetch dev tools data:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadAPIDocumentation = async (format: 'json' | 'markdown') => {
    try {
      const response = await fetch(`/api/dev-tools/api-docs?format=${format}`);
      if (response.ok) {
        const data = format === 'json' ? JSON.stringify(await response.json(), null, 2) : await response.text();
        const blob = new Blob([data], {
          type: format === 'json' ? 'application/json' : 'text/markdown'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `y0-api-docs.${format === 'json' ? 'json' : 'md'}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to download API documentation:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Terminal className="h-12 w-12 mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading developer tools...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Project Files</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectStats.files}</div>
            <p className="text-xs text-muted-foreground">
              {projectStats.linesOfCode.toLocaleString()} lines of code
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Git Commits</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gitStats.commits}</div>
            <p className="text-xs text-muted-foreground">
              {gitStats.branches} branches, {gitStats.pullRequests} PRs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performance.responseTime}ms</div>
            <p className="text-xs text-muted-foreground">
              {performance.throughput} req/s, {performance.errorRate}% error rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dependencies</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectStats.dependencies}</div>
            <p className="text-xs text-muted-foreground">
              {projectStats.testCoverage}% test coverage
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tools" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tools">Dev Tools</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="api">API Documentation</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
        </TabsList>

        <TabsContent value="tools" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {devTools.map((tool) => (
              <Card key={tool.name}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{tool.name}</CardTitle>
                    <Badge variant={tool.status === 'active' ? 'default' : 'secondary'}>
                      {tool.status}
                    </Badge>
                  </div>
                  <CardDescription>{tool.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>v{tool.version}</span>
                    <span>Last used: {tool.lastUsed}</span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="outline" disabled={tool.status !== 'active'}>
                      <Play className="h-4 w-4 mr-1" />
                      Launch
                    </Button>
                    <Button size="sm" variant="outline">
                      <Settings className="h-4 w-4 mr-1" />
                      Configure
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Response Time</CardTitle>
                <CardDescription>Average API response time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{performance.responseTime}ms</div>
                <Progress value={Math.min((performance.responseTime / 1000) * 100, 100)} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Throughput</CardTitle>
                <CardDescription>Requests per second</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{performance.throughput}</div>
                <Progress value={Math.min((performance.throughput / 1000) * 100, 100)} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Error Rate</CardTitle>
                <CardDescription>Percentage of failed requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{performance.errorRate}%</div>
                <Progress value={performance.errorRate} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Memory Usage</CardTitle>
                <CardDescription>Current memory consumption</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{performance.memoryUsage}%</div>
                <Progress value={performance.memoryUsage} className="mt-2" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertTitle>API Documentation</AlertTitle>
            <AlertDescription>
              Download comprehensive API documentation for the y0 platform in JSON or Markdown format.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Interactive API Docs</CardTitle>
                <CardDescription>
                  Browse and test API endpoints interactively
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open API Explorer
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Download Documentation</CardTitle>
                <CardDescription>
                  Export API documentation for offline use
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => downloadAPIDocumentation('json')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    JSON
                  </Button>
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => downloadAPIDocumentation('markdown')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Markdown
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>API Endpoints Overview</CardTitle>
              <CardDescription>
                Quick reference for available API endpoints
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-2 text-sm">
                  <div className="font-mono">POST /api/auth/login - User authentication</div>
                  <div className="font-mono">GET /api/analytics/events - Analytics data</div>
                  <div className="font-mono">POST /api/ai-optimizer/analyze - AI workflow analysis</div>
                  <div className="font-mono">GET /api/security/audit-logs - Security logs</div>
                  <div className="font-mono">GET /api/dev-tools/stats - Development statistics</div>
                  <div className="font-mono">GET /api/dev-tools/performance - Performance metrics</div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Database Status</CardTitle>
                <CardDescription>Current database connection and status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Connection</span>
                    <Badge variant="default">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Last Backup</span>
                    <span className="text-sm text-muted-foreground">2 hours ago</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Database Size</span>
                    <span className="text-sm text-muted-foreground">2.4 GB</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common database operations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button className="w-full" variant="outline" size="sm">
                    <Database className="h-4 w-4 mr-2" />
                    Run Migrations
                  </Button>
                  <Button className="w-full" variant="outline" size="sm">
                    <Activity className="h-4 w-4 mr-2" />
                    View Logs
                  </Button>
                  <Button className="w-full" variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export Backup
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}