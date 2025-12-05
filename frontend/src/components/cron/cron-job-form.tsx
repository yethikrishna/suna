/**
 * y0 Cron Job Form Component
 * Form for creating and editing cron jobs
 */

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateCronJobRequest } from '@/lib/cron/cron-manager'
import { getCommonCronExpressions, validateCronExpression, getCronDescription } from '@/hooks/react-query/cron/use-cron-jobs'

interface CronJobFormProps {
  workflowId: string
  workflowName: string
  initialData?: Partial<CreateCronJobRequest>
  onSubmit: (data: CreateCronJobRequest) => void
  onCancel: () => void
  isSubmitting?: boolean
}

export const CronJobForm: React.FC<CronJobFormProps> = ({
  workflowId,
  workflowName,
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false
}) => {
  const [formData, setFormData] = useState<CreateCronJobRequest>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    schedule: initialData?.schedule || '0 9 * * *', // Default: Every day at 9 AM
    workflowId,
    timezone: initialData?.timezone || 'UTC',
    retryCount: initialData?.retryCount || 3,
    timeout: initialData?.timeout || 30000,
    headers: initialData?.headers || {}
  })

  const [customSchedule, setCustomSchedule] = useState(false)
  const [isValidSchedule, setIsValidSchedule] = useState(true)

  const handleInputChange = (field: keyof CreateCronJobRequest, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))

    if (field === 'schedule') {
      setIsValidSchedule(validateCronExpression(value))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidSchedule) {
      return
    }
    onSubmit(formData)
  }

  const commonExpressions = getCommonCronExpressions()

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>
          {initialData ? 'Edit Cron Job' : 'Create Cron Job'}
        </CardTitle>
        <CardDescription>
          Schedule the workflow "<strong>{workflowName}</strong>" to run automatically
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Job Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., Daily Report Generation"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Optional description of what this cron job does"
                rows={3}
              />
            </div>
          </div>

          {/* Schedule Configuration */}
          <div className="space-y-4">
            <div>
              <Label>Schedule *</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={customSchedule}
                    onCheckedChange={setCustomSchedule}
                  />
                  <Label className="text-sm">Use custom cron expression</Label>
                </div>

                {customSchedule ? (
                  <div className="space-y-2">
                    <Input
                      value={formData.schedule}
                      onChange={(e) => handleInputChange('schedule', e.target.value)}
                      placeholder="* * * * * (minute hour day month weekday)"
                      className={`font-mono ${isValidSchedule ? '' : 'border-red-500'}`}
                    />
                    {!isValidSchedule && (
                      <p className="text-sm text-red-600">
                        Invalid cron expression. Use format: * * * * *
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Format: minute hour day month weekday (0-6, where 0 = Sunday)
                    </p>
                  </div>
                ) : (
                  <Select
                    value={formData.schedule}
                    onValueChange={(value) => handleInputChange('schedule', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select schedule" />
                    </SelectTrigger>
                    <SelectContent>
                      {commonExpressions.map((expr) => (
                        <SelectItem key={expr.value} value={expr.value}>
                          <div className="flex items-center justify-between w-full">
                            <span>{expr.label}</span>
                            <Badge variant="outline" className="ml-2 font-mono text-xs">
                              {expr.value}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {formData.schedule && isValidSchedule && (
                <div className="text-sm text-muted-foreground">
                  Schedule: <strong>{getCronDescription(formData.schedule)}</strong>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) => handleInputChange('timezone', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                  <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                  <SelectItem value="Europe/London">London (GMT)</SelectItem>
                  <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                  <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                  <SelectItem value="Asia/Shanghai">Shanghai (CST)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="space-y-4">
            <div>
              <Label>Advanced Settings</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <Label htmlFor="retryCount" className="text-sm">Retry Count</Label>
                  <Input
                    id="retryCount"
                    type="number"
                    min="0"
                    max="10"
                    value={formData.retryCount}
                    onChange={(e) => handleInputChange('retryCount', parseInt(e.target.value) || 0)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="timeout" className="text-sm">Timeout (seconds)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    min="5"
                    max="300"
                    value={Math.floor((formData.timeout || 30000) / 1000)}
                    onChange={(e) => handleInputChange('timeout', parseInt(e.target.value) * 1000)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="customHeaders" className="text-sm">Custom Headers (JSON)</Label>
              <Textarea
                id="customHeaders"
                value={JSON.stringify(formData.headers, null, 2)}
                onChange={(e) => {
                  try {
                    const headers = JSON.parse(e.target.value)
                    handleInputChange('headers', headers)
                  } catch (error) {
                    // Invalid JSON, don't update
                  }
                }}
                placeholder='{"Authorization": "Bearer token"}'
                rows={3}
                className="font-mono text-sm mt-1"
              />
            </div>
          </div>

          {/* Workflow Info */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm">
              <strong>Target Workflow:</strong> {workflowName}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              This cron job will trigger the selected workflow on the defined schedule.
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValidSchedule || isSubmitting}
            >
              {isSubmitting ? 'Creating...' : (initialData ? 'Update Cron Job' : 'Create Cron Job')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}