'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, Zap, TrendingUp, Target, Activity, BarChart3 } from 'lucide-react';

export function WorkflowOptimizerDashboard() {
  return (
    <div className="space-y-6">
      {/* Performance Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Optimization Score</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">87%</div>
            <Progress value={87} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance Gain</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+42%</div>
            <Badge variant="default" className="mt-2">Improved</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Optimizations</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">Running now</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost Savings</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23%</div>
            <Badge variant="secondary" className="mt-2">Reduced</Badge>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="analysis" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Performance Analysis</CardTitle>
                <CardDescription>Real-time workflow performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">Response Time</span>
                      <span className="text-sm font-medium">245ms</span>
                    </div>
                    <Progress value={75} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">Throughput</span>
                      <span className="text-sm font-medium">1,234/min</span>
                    </div>
                    <Progress value={82} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">Success Rate</span>
                      <span className="text-sm font-medium">98.5%</span>
                    </div>
                    <Progress value={98} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resource Usage</CardTitle>
                <CardDescription>Current resource utilization</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">CPU Usage</span>
                      <span className="text-sm font-medium">45%</span>
                    </div>
                    <Progress value={45} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">Memory</span>
                      <span className="text-sm font-medium">62%</span>
                    </div>
                    <Progress value={62} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">I/O Operations</span>
                      <span className="text-sm font-medium">28%</span>
                    </div>
                    <Progress value={28} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI-Powered Recommendations</CardTitle>
              <CardDescription>Intelligent suggestions to optimize your workflows</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    title: "Optimize Database Queries",
                    description: "Add indexes to improve query performance by 35%",
                    impact: "High",
                    confidence: 92
                  },
                  {
                    title: "Enable Response Caching",
                    description: "Cache API responses to reduce load by 28%",
                    impact: "Medium",
                    confidence: 88
                  },
                  {
                    title: "Implement Auto-scaling",
                    description: "Add dynamic scaling for peak loads",
                    impact: "High",
                    confidence: 85
                  }
                ].map((rec, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="h-5 w-5 text-blue-500" />
                        <h4 className="font-medium">{rec.title}</h4>
                        <Badge variant={rec.impact === 'High' ? 'default' : 'secondary'}>
                          {rec.impact} Impact
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{rec.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">Confidence:</span>
                        <div className="flex-1 max-w-24">
                          <Progress value={rec.confidence} className="h-2" />
                        </div>
                        <span className="text-xs">{rec.confidence}%</span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button size="sm">Apply</Button>
                      <Button variant="outline" size="sm">Details</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Optimization History</CardTitle>
              <CardDescription>Track your optimization progress over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <Activity className="h-8 w-8 text-green-500" />
                      <div>
                        <p className="font-medium">Optimization #{10 - i}</p>
                        <p className="text-sm text-muted-foreground">
                          {i === 1 ? '2 hours ago' : i === 2 ? '1 day ago' : '3 days ago'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-medium">+{15 + i * 8}%</p>
                        <p className="text-sm text-muted-foreground">Performance</p>
                      </div>
                      <Badge variant="default">Success</Badge>
                      <Button variant="outline" size="sm">
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}