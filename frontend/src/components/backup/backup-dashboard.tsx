'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Database, Download, Upload, Clock, Shield, Activity } from 'lucide-react';

export function BackupDashboard() {
  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Backup</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2 hours ago</div>
            <Badge variant="default" className="mt-2">
              <Shield className="h-3 w-3 mr-1" />
              Successful
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Backups</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8.2 GB</div>
            <Progress value={65} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Automated</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Daily</div>
            <Badge variant="secondary" className="mt-2">Active</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Manual Backup</CardTitle>
            <CardDescription>Create an immediate backup of your data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Create Backup
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Restore
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Backup Schedule</CardTitle>
            <CardDescription>Configure automated backup settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Daily backups</span>
                <Badge variant="default">2:00 AM</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Retention period</span>
                <Badge variant="secondary">30 days</Badge>
              </div>
              <Button variant="outline" size="sm" className="w-full mt-4">
                Configure Schedule
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Backups */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Backups</CardTitle>
          <CardDescription>History of your backup operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <Database className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Backup #{25 - i}</p>
                    <p className="text-sm text-muted-foreground">
                      {i === 1 ? '2 hours ago' : i === 2 ? '1 day ago' : '2 days ago'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="default">Success</Badge>
                  <span className="text-sm text-muted-foreground">2.4 GB</span>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}