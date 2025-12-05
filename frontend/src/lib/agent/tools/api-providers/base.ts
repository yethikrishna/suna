/**
 * y0 API Data Providers - Blink SDK Implementation
 * Base class for external API providers using Blink SDK secure proxy
 */

import { blink } from '@/lib/blink/client'

export interface EndpointSchema {
  route: string
  method: 'GET' | 'POST'
  name: string
  description: string
  payload: Record<string, any>
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  status?: number
}

/**
 * Base class for API data providers using Blink SDK
 * Handles secure API calls with secret substitution
 */
export abstract class DataProviderBase {
  protected baseUrl: string
  protected endpoints: Record<string, EndpointSchema>

  constructor(baseUrl: string, endpoints: Record<string, EndpointSchema>) {
    this.baseUrl = baseUrl
    this.endpoints = endpoints
  }

  /**
   * Get all available endpoints
   */
  getEndpoints(): Record<string, EndpointSchema> {
    return this.endpoints
  }

  /**
   * Get specific endpoint schema
   */
  getEndpoint(route: string): EndpointSchema | undefined {
    return this.endpoints[route]
  }

  /**
   * Call an API endpoint using Blink SDK secure proxy
   * @param route - Endpoint route (without leading slash)
   * @param payload - Request payload or query parameters
   * @returns API response
   */
  async callEndpoint<T = any>(
    route: string,
    payload?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    try {
      // Clean route name
      const cleanRoute = route.startsWith('/') ? route.slice(1) : route

      // Find endpoint configuration
      const endpoint = this.endpoints[cleanRoute]
      if (!endpoint) {
        throw new Error(`Endpoint '${route}' not found`)
      }

      // Build full URL
      const url = `${this.baseUrl}${endpoint.route}`

      // Prepare headers with Blink SDK secret substitution
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'y0-agent/1.0'
      }

      // Extract host for RapidAPI if needed
      if (url.includes('rapidapi.com')) {
        const urlParts = url.split('//')[1]?.split('/') || []
        if (urlParts.length > 0) {
          headers['x-rapidapi-host'] = urlParts[0]
          headers['x-rapidapi-key'] = '{{rapid_api_key}}' // Blink SDK will substitute this
        }
      }

      // Determine method and make request using Blink SDK
      const method = endpoint.method.toUpperCase()

      let response: any
      if (method === 'GET') {
        response = await blink.data.fetch({
          url,
          method: 'GET',
          headers,
          query: payload
        })
      } else if (method === 'POST') {
        response = await blink.data.fetch({
          url,
          method: 'POST',
          headers,
          body: payload
        })
      } else {
        throw new Error(`Unsupported HTTP method: ${method}`)
      }

      // Return successful response
      return {
        success: true,
        data: response.body || response,
        status: response.status
      }

    } catch (error) {
      console.error(`Error calling endpoint '${route}':`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Call endpoint asynchronously (fire and forget)
   * @param route - Endpoint route
   * @param payload - Request payload
   * @returns Promise that resolves when request is triggered
   */
  async callEndpointAsync(
    route: string,
    payload?: Record<string, any>
  ): Promise<ApiResponse<{ triggered: boolean }>> {
    try {
      // Clean route name
      const cleanRoute = route.startsWith('/') ? route.slice(1) : route

      // Find endpoint configuration
      const endpoint = this.endpoints[cleanRoute]
      if (!endpoint) {
        throw new Error(`Endpoint '${route}' not found`)
      }

      // Build full URL
      const url = `${this.baseUrl}${endpoint.route}`

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'y0-agent/1.0'
      }

      // Add RapidAPI headers if needed
      if (url.includes('rapidapi.com')) {
        const urlParts = url.split('//')[1]?.split('/') || []
        if (urlParts.length > 0) {
          headers['x-rapidapi-host'] = urlParts[0]
          headers['x-rapidapi-key'] = '{{rapid_api_key}}'
        }
      }

      // Make async request using Blink SDK
      const response = await blink.data.fetchAsync({
        url,
        method: endpoint.method,
        headers,
        body: payload
      })

      return {
        success: true,
        data: { triggered: true, response }
      }

    } catch (error) {
      console.error(`Error in async call to endpoint '${route}':`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Validate payload against endpoint schema
   * @param route - Endpoint route
   * @param payload - Payload to validate
   * @returns Validation result
   */
  validatePayload(route: string, payload: Record<string, any>): {
    valid: boolean
    missing?: string[]
    extra?: string[]
  } {
    const endpoint = this.endpoints[route]
    if (!endpoint) {
      return { valid: false, missing: ['Endpoint not found'] }
    }

    const requiredFields = Object.entries(endpoint.payload)
      .filter(([_, description]) => !description.toLowerCase().includes('optional'))
      .map(([field, _]) => field)

    const providedFields = Object.keys(payload)
    const missing = requiredFields.filter(field => !providedFields.includes(field))
    const extra = providedFields.filter(field => !Object.keys(endpoint.payload).includes(field))

    return {
      valid: missing.length === 0,
      missing: missing.length > 0 ? missing : undefined,
      extra: extra.length > 0 ? extra : undefined
    }
  }

  /**
   * Get tool schema for AI agent integration
   * @param route - Endpoint route
   * @returns Tool schema in OpenAI format
   */
  getToolSchema(route: string): {
    type: string
    function: {
      name: string
      description: string
      parameters: {
        type: string
        properties: Record<string, any>
        required: string[]
      }
    }
  } | null {
    const endpoint = this.endpoints[route]
    if (!endpoint) {
      return null
    }

    const properties: Record<string, any> = {}
    const required: string[] = []

    Object.entries(endpoint.payload).forEach(([field, description]) => {
      properties[field] = {
        type: 'string',
        description: description.toString()
      }

      // Mark as required if description doesn't mention "optional"
      if (!description.toLowerCase().includes('optional')) {
        required.push(field)
      }
    })

    return {
      type: 'function',
      function: {
        name: route.replace(/[^a-zA-Z0-9]/g, '_'),
        description: endpoint.description,
        parameters: {
          type: 'object',
          properties,
          required
        }
      }
    }
  }
}

/**
 * Utility function to create API provider instance
 */
export function createApiProvider<T extends DataProviderBase>(
  ProviderClass: new (baseUrl: string, endpoints: Record<string, EndpointSchema>) => T,
  baseUrl: string,
  endpoints: Record<string, EndpointSchema>
): T {
  return new ProviderClass(baseUrl, endpoints)
}

/**
 * Common error types for API providers
 */
export class ApiProviderError extends Error {
  constructor(
    message: string,
    public readonly endpoint?: string,
    public readonly statusCode?: number,
    public readonly response?: any
  ) {
    super(message)
    this.name = 'ApiProviderError'
  }
}

/**
 * Rate limit error for API calls
 */
export class RateLimitError extends ApiProviderError {
  public readonly retryAfter?: number

  constructor(
    message: string,
    retryAfter?: number,
    endpoint?: string
  ) {
    super(message, endpoint, 429)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

/**
 * Authentication error for API calls
 */
export class AuthenticationError extends ApiProviderError {
  constructor(message: string, endpoint?: string) {
    super(message, endpoint, 401)
    this.name = 'AuthenticationError'
  }
}