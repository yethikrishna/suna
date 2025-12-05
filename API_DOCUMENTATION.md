# y0 API Documentation

## 📚 Complete API Reference

This document provides comprehensive documentation for all y0 platform APIs, including endpoints for agents, workflows, cron jobs, and system management.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Base URLs](#base-urls)
3. [Error Handling](#error-handling)
4. [Rate Limiting](#rate-limiting)
5. [Agents API](#agents-api)
6. [Workflows API](#workflows-api)
7. [Datasets API](#datasets-api)
8. [MCP API](#mcp-api)
9. [Cron Jobs API](#cron-jobs-api)
10. [System API](#system-api)
11. [Tools API](#tools-api)

---

## 🔐 Authentication

### Method: Blink SDK Authentication
All API endpoints require authentication using the Blink SDK. Authentication is handled automatically in the client-side application.

```typescript
import { blink } from '@/lib/blink/client'

// User authentication
const user = await blink.auth.me()
if (!user) {
  // Redirect to login
  throw new Error('Unauthorized')
}
```

### Headers
```http
Authorization: Bearer <blink_token>
Content-Type: application/json
User-Agent: y0-client/1.0
```

---

## 🌐 Base URLs

### Production
```
https://your-domain.com/api
```

### Development
```
http://localhost:3000/api
```

---

## ❌ Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional error details"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Unprocessable Entity
- `429` - Too Many Requests
- `500` - Internal Server Error

---

## 🚦 Rate Limiting

All API endpoints are rate-limited to prevent abuse:

- **Standard Limits**: 100 requests per minute
- **Burst Limits**: 200 requests per minute for short bursts
- **Authentication Required**: Rate limiting is per authenticated user

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

---

## 🤖 Agents API

### Get Agents
Retrieve all agents for the authenticated user.

```http
GET /api/agents
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "agent_123",
      "name": "Content Writer",
      "description": "AI assistant for content creation",
      "instructions": "Write engaging and informative content",
      "model": "gpt-4",
      "temperature": 0.7,
      "maxTokens": 2000,
      "tools": ["web_search", "data_providers"],
      "isActive": true,
      "createdAt": "2024-01-01T12:00:00Z",
      "updatedAt": "2024-01-01T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalPages": 5,
    "totalCount": 100
  }
}
```

### Create Agent
Create a new AI agent.

```http
POST /api/agents
```

**Request Body:**
```json
{
  "name": "Data Analyst",
  "description": "AI assistant for data analysis",
  "instructions": "Analyze data and provide insights",
  "model": "gpt-4",
  "temperature": 0.5,
  "maxTokens": 1500,
  "tools": ["web_search", "filesystem"],
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "agent_456",
    "name": "Data Analyst",
    "description": "AI assistant for data analysis",
    "instructions": "Analyze data and provide insights",
    "model": "gpt-4",
    "temperature": 0.5,
    "maxTokens": 1500,
    "tools": ["web_search", "filesystem"],
    "isActive": true,
    "createdAt": "2024-01-01T12:00:00Z",
    "updatedAt": "2024-01-01T12:00:00Z"
  }
}
```

### Update Agent
Update an existing agent.

```http
PUT /api/agents/{agentId}
```

**Request Body:**
```json
{
  "name": "Updated Agent Name",
  "description": "Updated description",
  "temperature": 0.8
}
```

### Delete Agent
Delete an agent.

```http
DELETE /api/agents/{agentId}
```

**Response:**
```json
{
  "success": true,
  "message": "Agent deleted successfully"
}
```

### Execute Agent
Execute an agent with a prompt.

```http
POST /api/agents/{agentId}/execute
```

**Request Body:**
```json
{
  "prompt": "Analyze the latest sales data",
  "context": {
    "data_source": "sales_database",
    "timeframe": "last_30_days"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "exec_789",
    "result": "The sales data shows...",
    "tokensUsed": 1250,
    "executionTime": 3500,
    "toolCalls": [
      {
        "tool": "web_search",
        "input": "latest sales data trends",
        "output": "..."
      }
    ]
  }
}
```

---

## ⚙️ Workflows API

### Get Workflows
Retrieve all workflows for the authenticated user.

```http
GET /api/workflows
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "workflow_123",
      "name": "Daily Report Generator",
      "description": "Generates daily business reports",
      "steps": [
        {
          "id": "step_1",
          "name": "Fetch Data",
          "type": "tool",
          "config": {
            "toolName": "data_fetcher",
            "parameters": {}
          },
          "order": 0
        }
      ],
      "triggers": [],
      "isActive": true,
      "createdAt": "2024-01-01T12:00:00Z",
      "updatedAt": "2024-01-01T12:00:00Z",
      "lastRun": "2024-01-01T10:00:00Z",
      "runCount": 15
    }
  ]
}
```

### Create Workflow
Create a new workflow.

```http
POST /api/workflows
```

**Request Body:**
```json
{
  "name": "Email Newsletter Generator",
  "description": "Generates weekly email newsletter",
  "steps": [
    {
      "name": "Fetch Articles",
      "type": "tool",
      "config": {
        "toolName": "article_fetcher",
        "parameters": {
          "category": "tech"
        }
      },
      "order": 0
    },
    {
      "name": "Generate Content",
      "type": "agent",
      "config": {
        "agentId": "agent_123",
        "prompt": "Create newsletter content"
      },
      "order": 1
    }
  ],
  "isActive": true
}
```

### Execute Workflow
Execute a workflow.

```http
POST /api/workflows/{workflowId}/execute
```

**Request Body:**
```json
{
  "context": {
    "manual_trigger": true,
    "user_id": "user_123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "exec_456",
    "status": "completed",
    "startTime": "2024-01-01T12:00:00Z",
    "endTime": "2024-01-01T12:05:30Z",
    "results": {
      "steps": [
        {
          "stepName": "Fetch Articles",
          "success": true,
          "result": "..."
        }
      ],
      "summary": "Workflow completed successfully"
    }
  }
}
```

### Get Workflow Executions
Get execution history for a workflow.

```http
GET /api/workflows/{workflowId}/executions
```

**Query Parameters:**
- `limit`: Number of executions to return (default: 50)
- `offset`: Offset for pagination (default: 0)

---

## 📊 Datasets API

### Get Datasets
Retrieve all datasets for the authenticated user.

```http
GET /api/datasets
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "dataset_123",
      "name": "Customer Reviews",
      "description": "Customer feedback and reviews",
      "schema": {
        "fields": [
          {
            "name": "rating",
            "type": "number",
            "required": true
          },
          {
            "name": "review",
            "type": "text",
            "required": true
          }
        ]
      },
      "rowCount": 1250,
      "createdAt": "2024-01-01T12:00:00Z",
      "updatedAt": "2024-01-01T12:00:00Z"
    }
  ]
}
```

### Create Dataset
Create a new dataset.

```http
POST /api/datasets
```

**Request Body:**
```json
{
  "name": "Sales Data",
  "description": "Monthly sales figures",
  "schema": {
    "fields": [
      {
        "name": "month",
        "type": "string",
        "required": true
      },
      {
        "name": "revenue",
        "type": "number",
        "required": true
      }
    ]
  }
}
```

### Import Data to Dataset
Import CSV or JSON data into a dataset.

```http
POST /api/datasets/{datasetId}/import
```

**Request Body (multipart/form-data):**
```
file: data.csv
format: csv
```

---

## 🔌 MCP API

### Get MCP Servers
Retrieve available MCP servers.

```http
GET /api/mcp/servers
```

**Query Parameters:**
- `q`: Search query for semantic search
- `page`: Page number (default: 1)
- `pageSize`: Items per page (default: 20)

**Response:**
```json
{
  "success": true,
  "servers": [
    {
      "qualifiedName": "filesystem",
      "displayName": "File System",
      "description": "File system operations",
      "type": "builtin",
      "isDeployed": true,
      "tools": [
        {
          "name": "read_file",
          "description": "Read file contents",
          "inputSchema": {
            "type": "object",
            "properties": {
              "path": { "type": "string" }
            }
          }
        }
      ]
    }
  ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 20,
    "totalPages": 5,
    "totalCount": 100
  }
}
```

### Create MCP Connection
Create a connection to a custom MCP server.

```http
POST /api/mcp/connections
```

**Request Body:**
```json
{
  "name": "Custom MCP Server",
  "url": "https://api.example.com/mcp",
  "type": "http",
  "config": {
    "headers": {
      "Authorization": "Bearer token"
    }
  }
}
```

### Execute MCP Tool
Execute a tool on an MCP server.

```http
POST /api/mcp/execute
```

**Request Body:**
```json
{
  "serverId": "filesystem",
  "toolName": "read_file",
  "arguments": {
    "path": "/path/to/file.txt"
  }
}
```

---

## 🕒 Cron Jobs API

### Get Cron Jobs
Retrieve all cron jobs for the authenticated user.

```http
GET /api/cron/jobs
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `pageSize`: Items per page (default: 20)

**Response:**
```json
{
  "success": true,
  "jobs": [
    {
      "id": "cron_123",
      "name": "Daily Report",
      "description": "Generate daily business report",
      "schedule": "0 9 * * *",
      "workflowId": "workflow_456",
      "isActive": true,
      "lastRun": "2024-01-01T09:00:00Z",
      "nextRun": "2024-01-02T09:00:00Z",
      "runCount": 30,
      "timezone": "UTC"
    }
  ],
  "total": 15,
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

### Create Cron Job
Create a new cron job.

```http
POST /api/cron/jobs
```

**Request Body:**
```json
{
  "name": "Weekly Backup",
  "description": "Weekly data backup",
  "schedule": "0 2 * * 0",
  "workflowId": "workflow_789",
  "timezone": "UTC",
  "retryCount": 3,
  "timeout": 60000
}
```

### Execute Cron Job Manually
Manually trigger a cron job execution.

```http
POST /api/cron/jobs/{cronJobId}/execute
```

**Response:**
```json
{
  "success": true,
  "executionId": "exec_101",
  "workflowId": "workflow_456",
  "workflowName": "Daily Report",
  "cronJobName": "Daily Report",
  "triggeredAt": "2024-01-01T12:00:00Z"
}
```

### Get Cron Job Statistics
Get cron job statistics and analytics.

```http
GET /api/cron/stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 15,
    "active": 12,
    "inactive": 3,
    "totalRuns": 1250,
    "recentRuns": 8,
    "successRate": 94.5,
    "workflowsWithCron": 5
  },
  "recentExecutions": [
    {
      "id": "exec_102",
      "workflowId": "workflow_456",
      "status": "completed",
      "startedAt": "2024-01-01T09:00:00Z",
      "completedAt": "2024-01-01T09:05:30Z",
      "duration": 330000
    }
  ]
}
```

---

## 🔧 System API

### Health Check
Check system health and status.

```http
GET /api/health
```

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "version": "1.0.0",
  "services": {
    "blink": {
      "status": "connected",
      "responseTime": 150
    },
    "database": {
      "status": "connected",
      "responseTime": 50
    },
    "cron": {
      "status": "connected",
      "responseTime": 100
    }
  }
}
```

### Get Tools
Get available tools and their schemas.

```http
GET /api/tools
```

**Response:**
```json
{
  "success": true,
  "tools": [
    {
      "name": "web_search",
      "description": "Search the web for information",
      "schema": {
        "type": "function",
        "function": {
          "name": "web_search",
          "description": "Search the web for information",
          "parameters": {
            "type": "object",
            "properties": {
              "query": {
                "type": "string",
                "description": "Search query"
              }
            },
            "required": ["query"]
          }
        }
      }
    }
  ]
}
```

### Performance Metrics
Get system performance metrics.

```http
GET /api/performance
```

**Response:**
```json
{
  "success": true,
  "metrics": {
    "timestamp": "2024-01-01T12:00:00Z",
    "memoryUsage": 65.5,
    "responseTime": 125,
    "errorRate": 2.1,
    "activeUsers": 150,
    "requestCount": 1250
  }
}
```

---

## 🛠️ Tools API

### Execute Tool
Execute a specific tool.

```http
POST /api/tools/{toolName}
```

**Request Body:**
```json
{
  "parameters": {
    "query": "latest AI trends"
  }
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "tool": "web_search",
    "output": "Latest AI trends include...",
    "metadata": {
      "executionTime": 2500,
      "tokensUsed": 150
    }
  }
}
```

### Get Tool Schema
Get the schema for a specific tool.

```http
GET /api/tools/{toolName}/schema
```

---

## 📝 API Examples

### Complete Agent Creation and Execution

```javascript
// 1. Create an agent
const agentResponse = await fetch('/api/agents', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'Content Creator',
    description: 'AI assistant for creating marketing content',
    instructions: 'Create engaging marketing content',
    model: 'gpt-4',
    temperature: 0.7,
    tools: ['web_search', 'data_providers']
  })
})

const agent = await agentResponse.json()

// 2. Execute the agent
const executionResponse = await fetch(`/api/agents/${agent.data.id}/execute`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    prompt: 'Create a blog post about AI trends',
    context: {
      target_audience: 'marketers',
      tone: 'professional'
    }
  })
})

const result = await executionResponse.json()
console.log('Agent response:', result.data.result)
```

### Workflow with Cron Scheduling

```javascript
// 1. Create a workflow
const workflowResponse = await fetch('/api/workflows', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'Social Media Scheduler',
    description: 'Schedule social media posts automatically',
    steps: [
      {
        name: 'Generate Content',
        type: 'agent',
        config: {
          agentId: 'agent_123',
          prompt: 'Create social media content'
        }
      }
    ],
    isActive: true
  })
})

const workflow = await workflowResponse.json()

// 2. Schedule with cron job
const cronResponse = await fetch('/api/cron/jobs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'Daily Social Media Post',
    schedule: '0 9 * * 1-5', // Weekdays at 9 AM
    workflowId: workflow.data.id,
    timezone: 'America/New_York'
  })
})

const cronJob = await cronResponse.json()
console.log('Cron job created:', cronJob.data)
```

---

## 🔍 Testing

### Test Environment
- Base URL: `http://localhost:3000/api`
- Use test authentication tokens
- Mock external services for consistent testing

### Health Check Test
```bash
curl http://localhost:3000/api/health
```

### Authentication Test
```bash
curl -H "Authorization: Bearer test-token" \
     http://localhost:3000/api/agents
```

---

## 📞 Support

### API Documentation Updates
- Regular updates for new features
- Version compatibility notes
- Deprecation notices

### Getting Help
- Check error messages for guidance
- Review response codes and details
- Contact support with error details

---

**🎉 This API documentation covers all endpoints available in the y0 platform. Use these APIs to build applications and integrations with the y0 workflow automation system!**