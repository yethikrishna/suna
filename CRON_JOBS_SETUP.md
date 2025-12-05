# Cron Jobs Setup Guide

## Overview

The y0 platform includes a comprehensive cron job system that replaces QStash with **cron-job.org**, a free and reliable cron scheduling service. This allows you to schedule workflows to run automatically at specified times and intervals.

## Architecture

```
y0 Cron Job System
├── Cron Job Manager (/lib/cron/cron-manager.ts)
│   ├── Creates and manages cron jobs
│   ├── Integrates with cron-job.org API
│   └── Stores job metadata in Blink DB
├── Webhook Handler (/api/cron/webhook/[workflowId]/route.ts)
│   ├── Receives cron triggers
│   ├── Executes workflows
│   └── Handles retries and errors
├── API Routes (/api/cron/)
│   ├── /jobs - CRUD operations
│   ├── /stats - Analytics and metrics
│   └── /[id]/execute - Manual execution
└── UI Components (/components/cron/)
    ├── CronJobForm - Create/edit jobs
    ├── CronJobList - Manage existing jobs
    └── CronStats - Analytics dashboard
```

## Features

### ✅ **Core Capabilities**
- **Visual Cron Editor**: Easy-to-use interface for creating schedules
- **Common Schedules**: Pre-defined cron expressions (hourly, daily, weekly, etc.)
- **Custom Cron Expressions**: Full support for advanced scheduling
- **Timezone Support**: Schedule jobs in any timezone
- **Retry Logic**: Configurable retry attempts and timeouts
- **Manual Execution**: Test cron jobs on demand
- **Real-time Statistics**: Track execution history and success rates

### ✅ **Security & Reliability**
- **Secure Webhooks**: Protected webhook endpoints
- **Execution Logging**: Complete audit trail of all runs
- **Error Handling**: Graceful failure handling and notifications
- **Rate Limiting**: Built-in protection against abuse
- **Backup Storage**: Local backup of cron job configurations

## Setup Instructions

### 1. Get cron-job.org API Key

1. Visit [https://cron-job.org](https://cron-job.org)
2. Create a free account
3. Navigate to **API Settings**
4. Generate an API key
5. Copy the API key for configuration

### 2. Configure Environment Variables

Add the cron-job.org API key to your environment:

```bash
# .env.local
CRON_JOB_API_KEY="your_cron_job_api_key_here"
NEXT_PUBLIC_URL="https://your-domain.com"  # Important for webhooks
```

### 3. Deploy Webhook Endpoints

Ensure your application is deployed and accessible at the URL specified in `NEXT_PUBLIC_URL`. The webhook endpoints must be publicly reachable for cron-job.org to trigger them.

## Usage Guide

### Creating Cron Jobs

#### Method 1: Web Interface
1. Navigate to `/workflows/cron` in your y0 dashboard
2. Click **"Create Cron Job"**
3. Select the workflow to schedule
4. Configure the schedule:
   - **Common Schedule**: Choose from pre-defined options
   - **Custom Expression**: Enter your own cron expression
5. Set timezone and advanced options
6. Click **"Create Cron Job"**

#### Method 2: API
```typescript
import { cronJobManager } from '@/lib/cron/cron-manager'

const cronJob = await cronJobManager.createCronJob(userId, {
  name: 'Daily Report',
  description: 'Generate daily analytics report',
  schedule: '0 9 * * *',  // Every day at 9 AM
  workflowId: 'workflow_id_here',
  timezone: 'UTC',
  retryCount: 3,
  timeout: 30000
})
```

### Cron Expression Examples

| Expression | Description | When it Runs |
|------------|-------------|--------------|
| `* * * * *` | Every minute | :00 of every minute |
| `*/15 * * * *` | Every 15 minutes | :00, :15, :30, :45 |
| `0 * * * *` | Every hour | :00 of every hour |
| `0 9 * * *` | Daily at 9 AM | 9:00 AM every day |
| `0 9 * * 1-5` | Weekdays at 9 AM | 9:00 AM Mon-Fri |
| `0 0 1 * *` | Monthly | First day of each month at midnight |
| `0 0 * * 0` | Weekly | Every Sunday at midnight |
| `0 */6 * * *` | Every 6 hours | 12:00 AM, 6:00 AM, 12:00 PM, 6:00 PM |

### Managing Cron Jobs

#### View All Jobs
```bash
GET /api/cron/jobs
```

#### Update a Job
```bash
PUT /api/cron/jobs/{id}
{
  "name": "Updated Job Name",
  "isActive": false,
  "schedule": "0 10 * * *"  // Change to 10 AM
}
```

#### Delete a Job
```bash
DELETE /api/cron/jobs/{id}
```

#### Manual Execution
```bash
POST /api/cron/jobs/{id}/execute
```

### Monitoring and Statistics

#### Get Cron Job Stats
```typescript
const stats = await cronJobManager.getCronJobStats(userId)
console.log(stats)
// {
//   total: 5,
//   active: 3,
//   inactive: 2,
//   totalRuns: 125,
//   recentRuns: 8,
//   successRate: 94.4
// }
```

#### View Execution History
The dashboard shows:
- **Recent Executions**: Latest workflow runs
- **Success Rate**: Percentage of successful executions
- **Active Jobs**: Number of currently active cron jobs
- **System Health**: Overall system reliability

## API Reference

### Cron Job Manager

#### `createCronJob(userId, request)`
Creates a new cron job.

**Parameters:**
- `userId: string` - User ID
- `request: CreateCronJobRequest` - Cron job configuration

**Returns:** `Promise<CronJobResponse>`

#### `listCronJobs(userId, page, pageSize)`
Lists cron jobs for a user.

**Parameters:**
- `userId: string` - User ID
- `page: number` - Page number (default: 1)
- `pageSize: number` - Items per page (default: 20)

**Returns:** `Promise<CronJobListResponse>`

#### `updateCronJob(userId, cronJobId, updates)`
Updates an existing cron job.

**Parameters:**
- `userId: string` - User ID
- `cronJobId: string` - Cron job ID
- `updates: Partial<CreateCronJobRequest>` - Fields to update

**Returns:** `Promise<CronJobResponse>`

#### `deleteCronJob(userId, cronJobId)`
Deletes a cron job.

**Parameters:**
- `userId: string` - User ID
- `cronJobId: string` - Cron job ID

**Returns:** `Promise<{ success: boolean; error?: string }>`

### Webhook Handler

#### Endpoint: `POST /api/cron/webhook/[workflowId]`

Receives cron triggers from cron-job.org and executes the corresponding workflow.

**Request Body:**
```json
{
  "timestamp": "2024-01-01T09:00:00Z",
  "job": {
    "id": "cron_job_id",
    "title": "Daily Report"
  }
}
```

**Response:**
```json
{
  "success": true,
  "executionId": "execution_id_here",
  "workflowId": "workflow_id_here",
  "status": "completed"
}
```

## Troubleshooting

### Common Issues

#### 1. Webhook Not Triggering
**Cause:** Incorrect webhook URL or blocked access
**Solution:**
- Verify `NEXT_PUBLIC_URL` is set correctly
- Ensure your application is deployed and accessible
- Check firewall rules allow inbound requests

#### 2. Cron Job Not Creating
**Cause:** Invalid cron expression or API key issues
**Solution:**
- Validate cron expression format
- Verify cron-job.org API key is correct
- Check internet connectivity

#### 3. Workflow Execution Failures
**Cause:** Workflow errors or timeout issues
**Solution:**
- Check workflow execution logs
- Increase timeout in cron job settings
- Verify workflow has required permissions

#### 4. Timezone Issues
**Cause:** Incorrect timezone configuration
**Solution:**
- Set correct timezone in cron job settings
- Verify server timezone matches expectations
- Test with timezone-aware scheduling

### Debug Mode

Enable debug logging:
```typescript
// In your environment
DEBUG=cron:* node your-app.js
```

### Logs and Monitoring

Check execution logs:
1. Navigate to `/workflows/cron`
2. Click on **"Overview"** tab
3. Review **Recent Executions** section
4. Check individual job details for error messages

## Security Considerations

### Webhook Security
- All webhook endpoints are protected by authentication
- Request validation prevents malicious payloads
- Rate limiting prevents abuse

### API Key Security
- Store cron-job.org API key in environment variables
- Never commit API keys to version control
- Use secure key management practices

### Data Privacy
- Cron job configurations stored securely in Blink DB
- Execution logs contain minimal sensitive data
- Webhook payloads are validated and sanitized

## Best Practices

### Performance
- Use appropriate timeouts for workflow execution
- Set reasonable retry counts to avoid infinite loops
- Monitor cron job execution frequency and impact

### Reliability
- Test cron jobs with manual execution first
- Implement proper error handling in workflows
- Monitor success rates and investigate failures

### Maintenance
- Regularly review active cron jobs
- Clean up unused or failed cron jobs
- Update schedules based on changing requirements

## Migration from QStash

If migrating from the previous QStash system:

1. **Export Existing Schedules**: Save your current cron schedules
2. **Update Environment Variables**: Replace QStash keys with cron-job.org API key
3. **Recreate Cron Jobs**: Use the y0 interface to recreate schedules
4. **Test Webhooks**: Verify all webhooks are working correctly
5. **Update Monitoring**: Adjust alerting and monitoring configurations

## Support

For additional support:
- Check the [cron-job.org documentation](https://cron-job.org/api)
- Review the y0 dashboard error messages
- Examine browser console logs for client-side issues
- Contact support with specific error details

---

**Ready to automate your workflows?** Get started at `/workflows/cron` in your y0 dashboard!