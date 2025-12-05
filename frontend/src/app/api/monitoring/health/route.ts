import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Simulate health checks for various services
    const healthChecks = [
      {
        id: 'database',
        name: 'Database Connection',
        status: 'healthy',
        lastCheck: new Date(),
        responseTime: Math.floor(Math.random() * 100) + 20,
        details: {
          success: true,
          message: 'Database connection successful',
          metrics: {
            response_time: Math.floor(Math.random() * 100) + 20,
            connections: Math.floor(Math.random() * 50) + 10,
            query_time: Math.floor(Math.random() * 50) + 10
          }
        }
      },
      {
        id: 'api',
        name: 'API Health',
        status: 'healthy',
        lastCheck: new Date(),
        responseTime: Math.floor(Math.random() * 200) + 50,
        details: {
          success: true,
          message: 'API responding normally',
          metrics: {
            response_time: Math.floor(Math.random() * 200) + 50,
            requests_per_minute: Math.floor(Math.random() * 1000) + 500,
            success_rate: Number((Math.random() * 0.02 + 0.98).toFixed(4))
          }
        }
      },
      {
        id: 'cache',
        name: 'Cache Service',
        status: Math.random() > 0.8 ? 'degraded' : 'healthy',
        lastCheck: new Date(),
        responseTime: Math.floor(Math.random() * 150) + 10,
        details: {
          success: true,
          message: Math.random() > 0.8 ? 'Cache service responding slowly' : 'Cache service operational',
          metrics: {
            response_time: Math.floor(Math.random() * 150) + 10,
            hit_rate: Number((Math.random() * 0.2 + 0.8).toFixed(2)),
            memory_usage: Math.floor(Math.random() * 70) + 20
          }
        }
      },
      {
        id: 'storage',
        name: 'Storage Service',
        status: 'healthy',
        lastCheck: new Date(),
        responseTime: Math.floor(Math.random() * 100) + 30,
        details: {
          success: true,
          message: 'Storage service operational',
          metrics: {
            response_time: Math.floor(Math.random() * 100) + 30,
            disk_usage: Math.floor(Math.random() * 30) + 60,
            free_space: Math.floor(Math.random() * 100) + 200
          }
        }
      }
    ];

    // Determine overall health
    const unhealthyChecks = healthChecks.filter(check => check.status === 'unhealthy').length;
    const degradedChecks = healthChecks.filter(check => check.status === 'degraded').length;

    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthyChecks > 0) {
      overall = 'unhealthy';
    } else if (degradedChecks > 0) {
      overall = 'degraded';
    }

    const systemHealth = {
      overall,
      checks: healthChecks,
      activeAlerts: Math.floor(Math.random() * 10) + 1,
      criticalAlerts: Math.random() > 0.7 ? Math.floor(Math.random() * 3) + 1 : 0,
      uptime: Number((Math.random() * 0.5 + 99.5).toFixed(1)),
      lastUpdate: new Date()
    };

    return NextResponse.json({
      success: true,
      data: systemHealth,
    });
  } catch (error) {
    console.error('Error fetching health data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch health data' },
      { status: 500 }
    );
  }
}