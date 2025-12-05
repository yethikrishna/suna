import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    const apiDocs = {
      title: 'y0 Platform API Documentation',
      version: '1.0.0',
      description: 'Comprehensive API documentation for the y0 enterprise platform',
      baseUrl: process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
      lastUpdated: new Date().toISOString(),
      endpoints: {
        authentication: {
          'POST /api/auth/login': {
            description: 'Authenticate user and return session',
            parameters: {
              email: { type: 'string', required: true, description: 'User email address' },
              password: { type: 'string', required: true, description: 'User password' }
            },
            responses: {
              200: { description: 'Authentication successful', data: 'User session data' },
              401: { description: 'Invalid credentials' },
              500: { description: 'Server error' }
            }
          },
          'POST /api/auth/logout': {
            description: 'Logout user and invalidate session',
            responses: {
              200: { description: 'Logout successful' },
              500: { description: 'Server error' }
            }
          }
        },
        analytics: {
          'GET /api/analytics/events': {
            description: 'Get analytics events with optional filtering',
            parameters: {
              startDate: { type: 'string', format: 'date', description: 'Start date for filtering' },
              endDate: { type: 'string', format: 'date', description: 'End date for filtering' },
              event: { type: 'string', description: 'Specific event type to filter' },
              userId: { type: 'string', description: 'Filter by user ID' }
            },
            responses: {
              200: { description: 'Analytics events retrieved successfully', data: 'Array of events' },
              400: { description: 'Invalid parameters' },
              500: { description: 'Server error' }
            }
          },
          'POST /api/analytics/events': {
            description: 'Track a new analytics event',
            parameters: {
              event: { type: 'string', required: true, description: 'Event name' },
              userId: { type: 'string', required: true, description: 'User ID' },
              properties: { type: 'object', description: 'Event properties' }
            },
            responses: {
              201: { description: 'Event tracked successfully' },
              400: { description: 'Invalid event data' },
              500: { description: 'Server error' }
            }
          },
          'GET /api/analytics/realtime': {
            description: 'Get real-time analytics data',
            parameters: {
              metric: { type: 'string', description: 'Specific metric to retrieve' }
            },
            responses: {
              200: { description: 'Real-time data retrieved successfully', data: 'Real-time metrics' },
              500: { description: 'Server error' }
            }
          }
        },
        aiOptimizer: {
          'POST /api/ai-optimizer/analyze': {
            description: 'Analyze workflow using AI optimization',
            parameters: {
              workflowId: { type: 'string', required: true, description: 'Workflow ID to analyze' },
              options: {
                type: 'object',
                description: 'Analysis options',
                properties: {
                  includePerformance: { type: 'boolean', default: true },
                  includeCost: { type: 'boolean', default: true },
                  includeReliability: { type: 'boolean', default: true }
                }
              }
            },
            responses: {
              200: { description: 'Analysis completed successfully', data: 'AI analysis results' },
              400: { description: 'Invalid workflow ID or options' },
              500: { description: 'Analysis failed' }
            }
          },
          'POST /api/ai-optimizer/optimize': {
            description: 'Apply AI optimizations to workflow',
            parameters: {
              workflowId: { type: 'string', required: true, description: 'Workflow ID to optimize' },
              recommendations: {
                type: 'array',
                required: true,
                description: 'AI recommendations to apply',
                items: { type: 'object' }
              }
            },
            responses: {
              200: { description: 'Optimizations applied successfully', data: 'Optimization results' },
              400: { description: 'Invalid recommendations' },
              500: { description: 'Optimization failed' }
            }
          }
        },
        security: {
          'GET /api/security/audit-logs': {
            description: 'Get security audit logs',
            parameters: {
              startDate: { type: 'string', format: 'date', description: 'Start date for filtering' },
              endDate: { type: 'string', format: 'date', description: 'End date for filtering' },
              userId: { type: 'string', description: 'Filter by user ID' },
              action: { type: 'string', description: 'Filter by action type' }
            },
            responses: {
              200: { description: 'Audit logs retrieved successfully', data: 'Array of audit entries' },
              400: { description: 'Invalid parameters' },
              403: { description: 'Insufficient permissions' },
              500: { description: 'Server error' }
            }
          },
          'POST /api/security/scan': {
            description: 'Perform security scan',
            parameters: {
              type: { type: 'string', required: true, enum: ['vulnerability', 'compliance', 'full'], description: 'Scan type' },
              scope: { type: 'string', description: 'Scan scope' }
            },
            responses: {
              200: { description: 'Security scan completed', data: 'Scan results' },
              400: { description: 'Invalid scan parameters' },
              403: { description: 'Insufficient permissions' },
              500: { description: 'Scan failed' }
            }
          }
        },
        developerTools: {
          'GET /api/dev-tools/stats': {
            description: 'Get development statistics',
            responses: {
              200: { description: 'Development stats retrieved successfully', data: 'Project statistics' },
              500: { description: 'Server error' }
            }
          },
          'GET /api/dev-tools/performance': {
            description: 'Get performance metrics',
            parameters: {
              timeframe: { type: 'string', enum: ['1h', '24h', '7d', '30d'], description: 'Timeframe for metrics' }
            },
            responses: {
              200: { description: 'Performance metrics retrieved successfully', data: 'Performance data' },
              400: { description: 'Invalid timeframe' },
              500: { description: 'Server error' }
            }
          }
        }
      },
      schemas: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'User ID' },
            email: { type: 'string', format: 'email', description: 'User email' },
            name: { type: 'string', description: 'User name' },
            role: { type: 'string', enum: ['admin', 'user', 'developer'], description: 'User role' },
            createdAt: { type: 'string', format: 'date-time', description: 'Account creation date' },
            updatedAt: { type: 'string', format: 'date-time', description: 'Last update date' }
          }
        },
        analyticsEvent: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Event ID' },
            event: { type: 'string', description: 'Event name' },
            userId: { type: 'string', description: 'User ID' },
            properties: { type: 'object', description: 'Event properties' },
            timestamp: { type: 'string', format: 'date-time', description: 'Event timestamp' }
          }
        },
        workflow: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Workflow ID' },
            name: { type: 'string', description: 'Workflow name' },
            description: { type: 'string', description: 'Workflow description' },
            status: { type: 'string', enum: ['active', 'inactive', 'draft'], description: 'Workflow status' },
            createdAt: { type: 'string', format: 'date-time', description: 'Creation date' },
            updatedAt: { type: 'string', format: 'date-time', description: 'Last update date' }
          }
        }
      },
      errorCodes: {
        400: { description: 'Bad Request - Invalid parameters or data' },
        401: { description: 'Unauthorized - Authentication required' },
        403: { description: 'Forbidden - Insufficient permissions' },
        404: { description: 'Not Found - Resource not found' },
        429: { description: 'Too Many Requests - Rate limit exceeded' },
        500: { description: 'Internal Server Error - Server-side error' },
        502: { description: 'Bad Gateway - Upstream service error' },
        503: { description: 'Service Unavailable - Service temporarily down' }
      }
    };

    if (format === 'markdown') {
      const markdown = generateMarkdownDocs(apiDocs);
      return new NextResponse(markdown, {
        headers: { 'Content-Type': 'text/markdown' }
      });
    }

    return NextResponse.json(apiDocs);
  } catch (error) {
    console.error('Error generating API documentation:', error);
    return NextResponse.json(
      { error: 'Failed to generate API documentation' },
      { status: 500 }
    );
  }
}

function generateMarkdownDocs(docs: any): string {
  return `# ${docs.title}

**Version:** ${docs.version}
**Last Updated:** ${new Date(docs.lastUpdated).toLocaleDateString()}
**Base URL:** \`${docs.baseUrl}\`

## Overview

${docs.description}

## Authentication

Most API endpoints require authentication. Include your session token in the Authorization header:

\`\`\`
Authorization: Bearer <your-session-token>
\`\`\`

## Error Codes

| Code | Description |
|------|-------------|
${Object.entries(docs.errorCodes).map(([code, info]: [string, any]) =>
  `| ${code} | ${info.description} |`
).join('\n')}

## Endpoints

### Authentication

#### POST /api/auth/login
Authenticate user and return session.

**Parameters:**
${Object.entries(docs.endpoints.authentication['POST /api/auth/login'].parameters).map(([name, param]: [string, any]) =>
  `- \`${name}\` (${param.type}${param.required ? ', required' : ''}): ${param.description}`
).join('\n')}

**Responses:**
${Object.entries(docs.endpoints.authentication['POST /api/auth/login'].responses).map(([code, response]: [string, any]) =>
  `- \`${code}\`: ${response.description}`
).join('\n')}

#### POST /api/auth/logout
Logout user and invalidate session.

**Responses:**
${Object.entries(docs.endpoints.authentication['POST /api/auth/logout'].responses).map(([code, response]: [string, any]) =>
  `- \`${code}\`: ${response.description}`
).join('\n')}

### Analytics

#### GET /api/analytics/events
Get analytics events with optional filtering.

**Parameters:**
${Object.entries(docs.endpoints.analytics['GET /api/analytics/events'].parameters).map(([name, param]: [string, any]) =>
  `- \`${name}\` (${param.type}): ${param.description}`
).join('\n')}

**Responses:**
${Object.entries(docs.endpoints.analytics['GET /api/analytics/events'].responses).map(([code, response]: [string, any]) =>
  `- \`${code}\`: ${response.description}`
).join('\n')}

#### POST /api/analytics/events
Track a new analytics event.

**Parameters:**
${Object.entries(docs.endpoints.analytics['POST /api/analytics/events'].parameters).map(([name, param]: [string, any]) =>
  `- \`${name}\` (${param.type}${param.required ? ', required' : ''}): ${param.description}`
).join('\n')}

**Responses:**
${Object.entries(docs.endpoints.analytics['POST /api/analytics/events'].responses).map(([code, response]: [string, any]) =>
  `- \`${code}\`: ${response.description}`
).join('\n')}

### AI Optimizer

#### POST /api/ai-optimizer/analyze
Analyze workflow using AI optimization.

**Parameters:**
${Object.entries(docs.endpoints.aiOptimizer['POST /api/ai-optimizer/analyze'].parameters).map(([name, param]: [string, any]) =>
  `- \`${name}\` (${param.type}${param.required ? ', required' : ''}): ${param.description}`
).join('\n')}

**Responses:**
${Object.entries(docs.endpoints.aiOptimizer['POST /api/ai-optimizer/analyze'].responses).map(([code, response]: [string, any]) =>
  `- \`${code}\`: ${response.description}`
).join('\n')}

### Security

#### GET /api/security/audit-logs
Get security audit logs.

**Parameters:**
${Object.entries(docs.endpoints.security['GET /api/security/audit-logs'].parameters).map(([name, param]: [string, any]) =>
  `- \`${name}\` (${param.type}): ${param.description}`
).join('\n')}

**Responses:**
${Object.entries(docs.endpoints.security['GET /api/security/audit-logs'].responses).map(([code, response]: [string, any]) =>
  `- \`${code}\`: ${response.description}`
).join('\n')}

### Developer Tools

#### GET /api/dev-tools/stats
Get development statistics.

**Responses:**
${Object.entries(docs.endpoints.developerTools['GET /api/dev-tools/stats'].responses).map(([code, response]: [string, any]) =>
  `- \`${code}\`: ${response.description}`
).join('\n')}

## Data Models

### User
\`\`\`json
${JSON.stringify(docs.schemas.user, null, 2)}
\`\`\`

### Analytics Event
\`\`\`json
${JSON.stringify(docs.schemas.analyticsEvent, null, 2)}
\`\`\`

### Workflow
\`\`\`json
${JSON.stringify(docs.schemas.workflow, null, 2)}
\`\`\`

## Rate Limiting

API requests are rate-limited to prevent abuse. Standard rate limits:

- **Authentication endpoints:** 10 requests per minute
- **Analytics endpoints:** 100 requests per minute
- **AI Optimizer endpoints:** 20 requests per minute
- **Security endpoints:** 50 requests per minute
- **Developer Tools endpoints:** 200 requests per minute

Rate limit headers are included in all responses:

- \`X-RateLimit-Limit\`: Maximum requests per window
- \`X-RateLimit-Remaining\`: Remaining requests in current window
- \`X-RateLimit-Reset\`: Time when rate limit window resets

## SDKs and Libraries

Official SDKs are available for:

- **JavaScript/TypeScript:** \`npm install @y0/sdk\`
- **Python:** \`pip install y0-sdk\`
- **Go:** \`go get github.com/y0/sdk-go\`

## Support

For API support and questions:
- Documentation: [${docs.baseUrl}/docs](${docs.baseUrl}/docs)
- API Status: [${docs.baseUrl}/status](${docs.baseUrl}/status)
- Support: [support@y0.com](mailto:support@y0.com)
`;
}