/**
 * y0 Health Check API Route
 * Provides health status for monitoring and deployment
 */

import { NextRequest, NextResponse } from 'next/server'
import { blink } from '@/lib/blink/client'

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now()

    // Check Blink SDK connection
    let blinkStatus = 'disconnected'
    let blinkError = null

    try {
      // Test basic Blink SDK functionality
      await blink.auth.me()
      blinkStatus = 'connected'
    } catch (error) {
      blinkError = error instanceof Error ? error.message : 'Blink SDK connection error'
    }

    // Check environment variables
    const requiredEnvVars = ['NEXT_PUBLIC_BLINK_PROJECT_ID']
    const missingEnvVars = requiredEnvVars.filter(
      envVar => !process.env[envVar]
    )

    // Database health check (using Blink SDK)
    let dbStatus = 'unknown'
    try {
      if (blinkStatus === 'connected') {
        // Try a simple database operation
        await blink.db.agents?.list({ limit: 1 })
        dbStatus = 'healthy'
      } else {
        dbStatus = 'disconnected'
      }
    } catch (error) {
      dbStatus = 'error'
    }

    const responseTime = Date.now() - startTime

    const healthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        blink: {
          status: blinkStatus,
          error: blinkError
        },
        database: {
          status: dbStatus
        }
      },
      configuration: {
        missingEnvVars,
        hasBlinkProjectId: !!process.env.NEXT_PUBLIC_BLINK_PROJECT_ID,
        hasCronSecret: !!process.env.CRON_SECRET
      },
      features: {
        authentication: true,
        tools: true,
        agents: true,
        workflows: true,
        datasets: true,
        cronWebhooks: !!process.env.CRON_SECRET,
        dataProviders: true
      }
    }

    // Determine overall health status
    const isHealthy = blinkStatus === 'connected' && missingEnvVars.length === 0

    return NextResponse.json(healthData, {
      status: isHealthy ? 200 : 503
    })

  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed'
      },
      { status: 503 }
    )
  }
}