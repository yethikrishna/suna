'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart3, TrendingUp, Users, Activity, Calendar } from 'lucide-react';

export function AnalyticsDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45.2K</div>
            <Badge variant="default" className="mt-2">
              <TrendingUp className="h-3 w-3 mr-1" />
              +12%
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
            <Badge variant="default" className="mt-2">
              <TrendingUp className="h-3 w-3 mr-1" />
              +8%
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Page Views</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89.1K</div>
            <Badge variant="default" className="mt-2">
              <TrendingUp className="h-3 w-3 mr-1" />
              +23%
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3.2%</div>
            <Progress value={3.2} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Analytics Overview</CardTitle>
          <CardDescription>Key performance metrics and user behavior insights</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-medium mb-2">Traffic Sources</h4>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-sm">
                      <span>Direct</span>
                      <span>45%</span>
                    </div>
                    <Progress value={45} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm">
                      <span>Organic Search</span>
                      <span>28%</span>
                    </div>
                    <Progress value={28} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm">
                      <span>Social Media</span>
                      <span>15%</span>
                    </div>
                    <Progress value={15} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm">
                      <span>Referral</span>
                      <span>12%</span>
                    </div>
                    <Progress value={12} />
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">User Activity</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Session Duration</span>
                    <span>4m 32s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bounce Rate</span>
                    <span>32%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pages per Session</span>
                    <span>3.8</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Return Visitors</span>
                    <span>67%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}