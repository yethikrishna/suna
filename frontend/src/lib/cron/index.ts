/**
 * y0 Cron Job System
 * Complete cron job management with cron-job.org integration
 */

// Export types
export * from './cron-manager'

// Export manager instance
export { cronJobManager, CronJobManager } from './cron-manager'

// Export utilities
export const cronUtils = {
  /**
   * Validate a cron expression
   */
  isValidCronExpression(expression: string): boolean {
    const cronRegex = /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/
    return cronRegex.test(expression)
  },

  /**
   * Get human-readable description of cron expression
   */
  getCronDescription(expression: string): string {
    const descriptions: Record<string, string> = {
      '* * * * *': 'Every minute',
      '*/5 * * * *': 'Every 5 minutes',
      '*/15 * * * *': 'Every 15 minutes',
      '*/30 * * * *': 'Every 30 minutes',
      '0 * * * *': 'Every hour',
      '0 */6 * * *': 'Every 6 hours',
      '0 0 * * *': 'Every day at midnight',
      '0 9 * * *': 'Every day at 9 AM',
      '0 18 * * *': 'Every day at 6 PM',
      '0 9 * * 1-5': 'Every weekday at 9 AM',
      '0 10 * * 0,6': 'Every weekend at 10 AM',
      '0 0 * * 0': 'Every Sunday at midnight',
      '0 0 1 * *': 'Every month on the 1st',
      '0 0 1 * *': 'First day of every month'
    }

    return descriptions[expression] || expression
  },

  /**
   * Get common cron expressions
   */
  getCommonCronExpressions() {
    return [
      { label: 'Every minute', value: '* * * * *' },
      { label: 'Every 5 minutes', value: '*/5 * * * *' },
      { label: 'Every 15 minutes', value: '*/15 * * * *' },
      { label: 'Every 30 minutes', value: '*/30 * * * *' },
      { label: 'Every hour', value: '0 * * * *' },
      { label: 'Every 6 hours', value: '0 */6 * * *' },
      { label: 'Every day at midnight', value: '0 0 * * *' },
      { label: 'Every day at 9 AM', value: '0 9 * * *' },
      { label: 'Every day at 6 PM', value: '0 18 * * *' },
      { label: 'Every weekday at 9 AM', value: '0 9 * * 1-5' },
      { label: 'Every weekend at 10 AM', value: '0 10 * * 0,6' },
      { label: 'Every Sunday at midnight', value: '0 0 * * 0' },
      { label: 'Every month on the 1st', value: '0 0 1 * *' },
      { label: 'Every Monday at 9 AM', value: '0 9 * * 1' }
    ]
  },

  /**
   * Calculate next run time (simplified)
   */
  getNextRunTime(schedule: string, timezone: string = 'UTC'): Date | null {
    try {
      // This is a simplified implementation
      // In production, use a proper cron parser like node-cron
      const now = new Date()
      const parts = schedule.split(' ')

      if (parts.length !== 5) {
        return null
      }

      const [minute, hour, day, month, weekday] = parts
      const nextRun = new Date(now)

      // Very basic calculation - in production use proper cron parser
      if (minute !== '*') {
        nextRun.setMinutes(parseInt(minute))
      }
      if (hour !== '*') {
        nextRun.setHours(parseInt(hour))
      }

      // If the calculated time is in the past, add appropriate interval
      if (nextRun <= now) {
        if (minute === '*' && hour === '*') {
          nextRun.setTime(now.getTime() + 60 * 1000) // Add 1 minute
        } else if (hour === '*') {
          nextRun.setTime(now.getTime() + 60 * 60 * 1000) // Add 1 hour
        } else {
          nextRun.setDate(nextRun.getDate() + 1) // Add 1 day
        }
      }

      return nextRun
    } catch (error) {
      console.error('Error calculating next run time:', error)
      return null
    }
  },

  /**
   * Get timezone list
   */
  getTimezones() {
    return [
      { value: 'UTC', label: 'UTC' },
      { value: 'America/New_York', label: 'Eastern Time (ET)' },
      { value: 'America/Chicago', label: 'Central Time (CT)' },
      { value: 'America/Denver', label: 'Mountain Time (MT)' },
      { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
      { value: 'Europe/London', label: 'London (GMT)' },
      { value: 'Europe/Paris', label: 'Paris (CET)' },
      { value: 'Europe/Berlin', label: 'Berlin (CET)' },
      { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
      { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
      { value: 'Asia/Kolkata', label: 'India (IST)' },
      { value: 'Australia/Sydney', label: 'Sydney (AEDT)' }
    ]
  },

  /**
   * Format execution duration
   */
  formatDuration(startTime: Date, endTime?: Date): string {
    const end = endTime || new Date()
    const duration = end.getTime() - startTime.getTime()

    if (duration < 1000) {
      return `${duration}ms`
    } else if (duration < 60000) {
      return `${(duration / 1000).toFixed(1)}s`
    } else {
      const minutes = Math.floor(duration / 60000)
      const seconds = Math.floor((duration % 60000) / 1000)
      return `${minutes}m ${seconds}s`
    }
  },

  /**
   * Format relative time
   */
  formatRelativeTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) {
      return 'Just now'
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
    } else {
      return d.toLocaleDateString()
    }
  },

  /**
   * Validate cron job configuration
   */
  validateCronJob(config: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!config.name || config.name.trim().length === 0) {
      errors.push('Job name is required')
    }

    if (!config.schedule) {
      errors.push('Schedule is required')
    } else if (!this.isValidCronExpression(config.schedule)) {
      errors.push('Invalid cron expression')
    }

    if (!config.workflowId) {
      errors.push('Workflow ID is required')
    }

    if (config.timeout && (config.timeout < 5000 || config.timeout > 300000)) {
      errors.push('Timeout must be between 5 seconds and 5 minutes')
    }

    if (config.retryCount && (config.retryCount < 0 || config.retryCount > 10)) {
      errors.push('Retry count must be between 0 and 10')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}

// Export validation utilities
export { cronUtils as validate }

// Default export
export default {
  utils: cronUtils
}