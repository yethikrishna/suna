/**
 * y0 Tools API Route
 * Provides information about available tools and their schemas
 */

import { NextRequest, NextResponse } from 'next/server'
import { blink } from '@/lib/blink/client'
import { getAllToolSchemas, agentTools } from '@/lib/agent/tools'

export async function GET(request: NextRequest) {
  try {
    // Get current user using Blink SDK
    const user = await blink.auth.me()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get all available tool schemas
    const toolSchemas = getAllToolSchemas()

    // Get tool registry information
    const toolRegistry = {
      search: {
        available: true,
        tools: ['web_search', 'scrape_webpage', 'take_screenshot']
      },
      dataProviders: {
        available: true,
        providers: ['linkedin', 'twitter', 'amazon', 'yahooFinance', 'zillow']
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        schemas: toolSchemas,
        registry: toolRegistry,
        version: '1.0.0',
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error fetching tools:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch tools'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const user = await blink.auth.me()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body for tool testing
    const body = await request.json()
    const { toolName, parameters, testMode } = body

    if (!toolName) {
      return NextResponse.json(
        { error: 'Tool name is required' },
        { status: 400 }
      )
    }

    // Import executeTool function
    const { executeTool } = await import('@/lib/agent/tools')

    // Execute the tool (only in test mode)
    if (testMode) {
      try {
        const result = await executeTool(toolName, parameters || {})

        return NextResponse.json({
          success: true,
          data: {
            toolName,
            parameters,
            result,
            testMode: true,
            timestamp: new Date().toISOString()
          }
        })

      } catch (toolError) {
        return NextResponse.json({
          success: false,
          error: `Tool execution failed: ${toolError instanceof Error ? toolError.message : 'Unknown error'}`,
          toolName,
          parameters
        }, { status: 500 })
      }
    } else {
      // Non-test mode - just validate tool exists and parameters
      const toolSchemas = getAllToolSchemas()
      const toolSchema = toolSchemas[toolName]

      if (!toolSchema) {
        return NextResponse.json(
          { error: `Tool '${toolName}' not found` },
          { status: 404 }
        )
      }

      // Validate parameters against schema
      const validation = validateToolParameters(toolSchema, parameters || {})

      return NextResponse.json({
        success: true,
        data: {
          toolName,
          schema: toolSchema,
          validation,
          message: 'Tool validation successful. Set testMode: true to execute.',
          timestamp: new Date().toISOString()
        }
      })
    }

  } catch (error) {
    console.error('Error in tools API:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Tools API error'
      },
      { status: 500 }
    )
  }
}

function validateToolParameters(schema: any, parameters: Record<string, any>): {
  valid: boolean
  missing: string[]
  invalid: string[]
} {
  const missing: string[] = []
  const invalid: string[] = []

  if (!schema || !schema.function || !schema.function.parameters) {
    return { valid: false, missing: ['Invalid tool schema'], invalid }
  }

  const required = schema.function.parameters.required || []
  const properties = schema.function.parameters.properties || {}

  // Check for missing required parameters
  for (const requiredParam of required) {
    if (!(requiredParam in parameters)) {
      missing.push(requiredParam)
    }
  }

  // Check for invalid parameter types
  for (const [paramName, paramValue] of Object.entries(parameters)) {
    const paramSchema = properties[paramName]
    if (paramSchema) {
      const expectedType = paramSchema.type
      const actualType = typeof paramValue

      // Basic type validation
      if (expectedType === 'string' && actualType !== 'string') {
        invalid.push(`${paramName}: expected ${expectedType}, got ${actualType}`)
      } else if (expectedType === 'number' && actualType !== 'number') {
        invalid.push(`${paramName}: expected ${expectedType}, got ${actualType}`)
      } else if (expectedType === 'boolean' && actualType !== 'boolean') {
        invalid.push(`${paramName}: expected ${expectedType}, got ${actualType}`)
      } else if (expectedType === 'array' && !Array.isArray(paramValue)) {
        invalid.push(`${paramName}: expected ${expectedType}, got ${actualType}`)
      } else if (expectedType === 'object' && (actualType !== 'object' || Array.isArray(paramValue))) {
        invalid.push(`${paramName}: expected ${expectedType}, got ${actualType}`)
      }
    }
  }

  return {
    valid: missing.length === 0 && invalid.length === 0,
    missing,
    invalid
  }
}