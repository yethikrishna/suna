/**
 * y0 Backup & Disaster Recovery Dashboard
 * Comprehensive backup management and disaster recovery interface
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Database,
  Cloud,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  FileText,
  Server,
  Users,
  Calendar,
  TrendingUp,
  Download,
  Upload,
  Settings,
  Activity,
  Zap
} from 'lucide-react'
import { backupManager, BackupConfig, BackupJob, RestoreJob, DisasterRecoveryPlan } from '@/lib/backup/backup-manager'

interface BackupSummary {
  totalConfigs: number
  activeJobs: number
  completedBackups: number
  failedBackups: number
  totalSize: number
  averageDuration: number
  successRate: number
  lastBackup: Date | null
  nextScheduledBackup: Date | null
}

export function BackupDashboard() {
  const [backupSummary, setBackupSummary] = useState<BackupSummary | null>(null)
  const [backupConfigs, setBackupConfigs] = useState<BackupConfig[]>([])
  const [activeJobs, setActiveJobs] = useState<BackupJob[]>([])
  const [restoreJobs, setRestoreJobs] = useState<RestoreJob[]>([])
  const [drPlans, setDrPlans] = useState<DisasterRecoveryPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState('overview')

  useEffect(() => {
    loadBackupData()
    const interval = setInterval(loadBackupData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const loadBackupData = async () => {
    try {
      const [summary, configs, jobs, restores, plans] = await Promise.all([
        getBackupSummary(),
        getBackupConfigs(),
        getActiveJobs(),
        getRestoreJobs(),
        getDRPlans()
      ])

      setBackupSummary(summary)
      setBackupConfigs(configs)
      setActiveJobs(jobs)
      setRestoreJobs(restores)
      setDrPlans(plans)
      setIsLoading(false)
    } catch (error) {
      console.error('Failed to load backup data:', error)
      setIsLoading(false)
    }
  }

  // Mock API calls - replace with actual API calls
  const getBackupSummary = async (): Promise<BackupSummary> => {
    await new Promise(resolve => setTimeout(resolve, 500))
    return {
      totalConfigs: 5,
      activeJobs: 2,
      completedBackups: 147,
      failedBackups: 3,
      totalSize: 2.4 * 1024 * 1024 * 1024 * 1024, // 2.4 TB
      averageDuration: 1800, // 30 minutes
      successRate: 98.0,
      lastBackup: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      nextScheduledBackup: new Date(Date.now() + 8 * 60 * 60 * 1000) // 8 hours from now
    }
  }

  const getBackupConfigs = async (): Promise<BackupConfig[]> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    return [
      {
        id: 'config_1',
        name: 'Daily Full Backup',
        description: 'Complete daily backup of all critical systems',
        type: 'full',
        frequency: 'daily',
        retention: { daily: 7, weekly: 4, monthly: 12, yearly: 5 },
        compression: true,
        encryption: true,
        destinations: [],
        includes: ['/data', '/config', '/logs'],
        excludes: ['/tmp', '/cache'],
        enabled: true,
        priority: 1,
        timeout: 7200,
        metadata: {
          createdBy: 'admin',
          createdAt: new Date('2024-01-01'),
          lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000),
          nextRun: new Date(Date.now() + 22 * 60 * 60 * 1000)
        }
      },
      {
        id: 'config_2',
        name: 'Hourly Incremental Backup',
        description: 'Incremental backup of changed files',
        type: 'incremental',
        frequency: 'hourly',
        retention: { daily: 24, weekly: 7, monthly: 4, yearly: 1 },
        compression: true,
        encryption: true,
        destinations: [],
        includes: ['/data'],
        excludes: ['/data/cache'],
        enabled: true,
        priority: 2,
        timeout: 1800,
        metadata: {
          createdBy: 'admin',
          createdAt: new Date('2024-01-01'),
          lastRun: new Date(Date.now() - 30 * 60 * 1000),
          nextRun: new Date(Date.now() + 30 * 60 * 1000)
        }
      }
    ]
  }

  const getActiveJobs = async (): Promise<BackupJob[]> => {
    await new Promise(resolve => setTimeout(resolve, 200))
    return [
      {
        id: 'job_1',
        configId: 'config_1',
        status: 'running',
        type: 'full',
        startedAt: new Date(Date.now() - 15 * 60 * 1000),
        size: 1024 * 1024 * 1024 * 1.5, // 1.5 GB
        encrypted: true,
        files: [],
        destinations: [],
        progress: 65,
        metadata: {
          triggeredBy: 'schedule',
          environment: 'production',
          version: '1.0.0'
        }
      },
      {
        id: 'job_2',
        configId: 'config_2',
        status: 'running',
        type: 'incremental',
        startedAt: new Date(Date.now() - 5 * 60 * 1000),
        size: 1024 * 1024 * 500, // 500 MB
        encrypted: true,
        files: [],
        destinations: [],
        progress: 25,
        metadata: {
          triggeredBy: 'schedule',
          environment: 'production',
          version: '1.0.0'
        }
      }
    ]
  }

  const getRestoreJobs = async (): Promise<RestoreJob[]> => {
    await new Promise(resolve => setTimeout(resolve, 200))
    return [
      {
        id: 'restore_1',
        backupJobId: 'job_prev',
        status: 'completed',
        sourceDestination: 's3-backup',
        targetDestination: '/restored-data',
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        duration: 3600,
        progress: 100,
        filesRestored: 15420,
        totalFiles: 15420,
        sizeRestored: 1024 * 1024 * 1024 * 2.1, // 2.1 GB
        totalSize: 1024 * 1024 * 1024 * 2.1,
        validation: {
          checksumVerification: true,
          filePermissions: true,
          symbolicLinks: true,
          fileTimestamps: true
        },
        metadata: {
          triggeredBy: 'admin',
          environment: 'production',
          restorePoint: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    ]
  }

  const getDRPlans = async (): Promise<DisasterRecoveryPlan[]> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    return [
      {
        id: 'dr_1',
        name: 'Primary Site Recovery',
        description: 'Complete recovery plan for primary data center failure',
        rto: 240, // 4 hours
        rpo: 60, // 1 hour
        priority: 'critical',
        environments: ['production'],
        services: [],
        procedures: [],
        contacts: [],
        tests: [],
        lastUpdated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        approvedBy: 'cto',
        status: 'active'
      },
      {
        id: 'dr_2',
        name: 'Database Recovery',
        description: 'Database-specific recovery procedures',
        rto: 120, // 2 hours
        rpo: 15, // 15 minutes
        priority: 'high',
        environments: ['production'],
        services: [],
        procedures: [],
        contacts: [],
        tests: [],
        lastUpdated: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        approvedBy: 'dba-lead',
        status: 'active'
      }
    ]
  }

  const formatBytes = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      running: 'default',
      completed: 'default',
      failed: 'destructive',
      pending: 'secondary',
      cancelled: 'outline'
    } as const

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RotateCcw className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading backup data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Backup & Disaster Recovery</h1>
          <p className="text-muted-foreground">Comprehensive backup management and disaster recovery planning</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
          <Button size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Create Backup
          </Button>
        </div>
      </div>

      {/* Backup Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{backupSummary?.successRate || 0}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {backupSummary?.completedBackups || 0} successful
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(backupSummary?.totalSize || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all backups
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{backupSummary?.activeJobs || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Backup</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {backupSummary?.lastBackup ? formatDuration((Date.now() - backupSummary.lastBackup.getTime()) / 1000) : 'Never'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {backupSummary?.lastBackup ? 'ago' : 'No backups yet'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="backups">Backups</TabsTrigger>
          <TabsTrigger value="restores">Restores</TabsTrigger>
          <TabsTrigger value="disaster-recovery">DR Plans</TabsTrigger>
          <TabsTrigger value="destinations">Destinations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Active Backup Jobs */}
            <Card>
              <CardHeader>
                <CardTitle>Active Backup Jobs</CardTitle>
                <CardDescription>
                  Currently running backup operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activeJobs.map((job) => (
                    <div key={job.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(job.status)}
                          <h4 className="font-semibold capitalize">{job.type} Backup</h4>
                        </div>
                        {getStatusBadge(job.status)}
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span>{job.progress}%</span>
                        </div>
                        <Progress value={job.progress} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Size: {formatBytes(job.size)}</span>
                          <span>Started: {job.startedAt?.toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {activeJobs.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                      <p>No active backup jobs</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Backup Configurations */}
            <Card>
              <CardHeader>
                <CardTitle>Backup Configurations</CardTitle>
                <CardDescription>
                  Scheduled backup jobs and their settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {backupConfigs.map((config) => (
                    <div key={config.id} className="flex items-center justify-between p-3 rounded border">
                      <div className="flex items-center gap-3">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{config.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {config.type} • {config.frequency}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={config.enabled ? 'default' : 'secondary'}>
                          {config.enabled ? 'Active' : 'Inactive'}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          Next: {config.metadata.nextRun?.toLocaleTimeString() || 'Not scheduled'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Disaster Recovery Plans Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Disaster Recovery Plans</CardTitle>
              <CardDescription>
                Active disaster recovery and business continuity plans
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {drPlans.map((plan) => (
                  <div key={plan.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold">{plan.name}</h4>
                      <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                        {plan.status}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">RTO:</span>
                        <span>{formatDuration(plan.rto * 60)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">RPO:</span>
                        <span>{formatDuration(plan.rpo * 60)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Priority:</span>
                        <span className="capitalize">{plan.priority}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Updated:</span>
                        <span>{plan.lastUpdated.toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backups" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Backup History</h3>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Recent backup jobs would be displayed here */}
                <div className="text-center py-12 text-muted-foreground">
                  <Database className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold">Backup History</h3>
                  <p>View and manage completed backup jobs</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="restores" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Restore Operations</h3>
            <Button variant="outline" size="sm">
              <RotateCcw className="h-4 w-4 mr-2" />
              New Restore
            </Button>
          </div>

          <div className="grid gap-4">
            {restoreJobs.map((job) => (
              <Card key={job.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-3">
                      {getStatusIcon(job.status)}
                      <div>
                        <h4 className="font-semibold">Restore Operation</h4>
                        <p className="text-sm text-muted-foreground">
                          {job.sourceDestination} → {job.targetDestination}
                        </p>
                        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                          <span>Files: {job.filesRestored.toLocaleString()}/{job.totalFiles.toLocaleString()}</span>
                          <span>Size: {formatBytes(job.sizeRestored)}/{formatBytes(job.totalSize)}</span>
                          <span>Duration: {formatDuration(job.duration || 0)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(job.status)}
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatDuration(job.duration || 0)}</p>
                        <p className="text-xs text-muted-foreground">
                          {job.completedAt?.toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {restoreJobs.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <RotateCcw className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold">No Restore Operations</h3>
                  <p>Start a new restore operation to recover data</p>
                  <Button className="mt-4" variant="outline">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    New Restore
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="disaster-recovery" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Disaster Recovery Plans</h3>
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              Create Plan
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {drPlans.map((plan) => (
              <Card key={plan.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{plan.name}</CardTitle>
                    <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                      {plan.status}
                    </Badge>
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">RTO</p>
                      <p className="text-lg font-semibold">{formatDuration(plan.rto * 60)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">RPO</p>
                      <p className="text-lg font-semibold">{formatDuration(plan.rpo * 60)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <FileText className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Play className="h-4 w-4 mr-2" />
                      Run Test
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="destinations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Backup Destinations</CardTitle>
              <CardDescription>
                Configure and manage backup storage destinations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Cloud className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold">Storage Destinations</h3>
                <p>Configure cloud storage, local storage, and network destinations</p>
                <Button className="mt-4" variant="outline">
                  <Cloud className="h-4 w-4 mr-2" />
                  Add Destination
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}