import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '24h';
    const metrics = searchParams.get('metrics')?.split(',') || [];

    // Generate comprehensive metrics data
    const generateTrendData = (baseValue: number, variance: number, points: number) => {
      return Array.from({ length: points }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
        value: baseValue + (Math.random() - 0.5) * variance
      })).reverse();
    };

    const performanceData = {
      responseTime: {
        current: Math.floor(Math.random() * 300) + 100,
        average: Math.floor(Math.random() * 200) + 150,
        p95: Math.floor(Math.random() * 500) + 200,
        p99: Math.floor(Math.random() * 1000) + 400,
        trend: generateTrendData(180, 50, 24)
      },
      availability: {
        current: Number((Math.random() * 2 + 98).toFixed(2)),
        average: Number((Math.random() * 1.5 + 98.5).toFixed(2)),
        uptime: Number((Math.random() * 0.5 + 99.5).toFixed(2)),
        downtime: Math.floor(Math.random() * 60) + 10,
        trend: generateTrendData(99.2, 0.5, 24)
      },
      errorRate: {
        current: Number((Math.random() * 5).toFixed(2)),
        average: Number((Math.random() * 3).toFixed(2)),
        errors24h: Math.floor(Math.random() * 1000) + 500,
        trend: generateTrendData(1.5, 1, 24)
      },
      throughput: {
        current: Math.floor(Math.random() * 2000) + 1000,
        average: Math.floor(Math.random() * 1500) + 800,
        requests24h: Math.floor(Math.random() * 100000) + 50000,
        trend: generateTrendData(1200, 400, 24)
      }
    };

    const resourceData = {
      cpu: {
        current: Number((Math.random() * 60 + 20).toFixed(1)),
        average: Number((Math.random() * 50 + 25).toFixed(1)),
        peak: Number((Math.random() * 80 + 20).toFixed(1)),
        cores: Math.floor(Math.random() * 8) + 2,
        trend: generateTrendData(45, 15, 24)
      },
      memory: {
        current: Number((Math.random() * 70 + 20).toFixed(1)),
        average: Number((Math.random() * 60 + 25).toFixed(1)),
        peak: Number((Math.random() * 85 + 15).toFixed(1)),
        total: 16, // GB
        available: Number((Math.random() * 8 + 4).toFixed(1)),
        trend: generateTrendData(55, 20, 24)
      },
      disk: {
        current: Number((Math.random() * 70 + 20).toFixed(1)),
        average: Number((Math.random() * 60 + 25).toFixed(1)),
        total: 500, // GB
        used: Number((Math.random() * 300 + 100).toFixed(1)),
        free: Number((Math.random() * 200 + 100).toFixed(1)),
        trend: generateTrendData(65, 10, 24)
      },
      network: {
        inbound: Math.floor(Math.random() * 1000) + 500, // Mbps
        outbound: Math.floor(Math.random() * 800) + 300, // Mbps
        connections: Math.floor(Math.random() * 1000) + 200,
        trend: generateTrendData(600, 300, 24)
      }
    };

    const applicationData = {
      activeUsers: Math.floor(Math.random() * 5000) + 1000,
      pageViews24h: Math.floor(Math.random() * 100000) + 50000,
      sessions24h: Math.floor(Math.random() * 20000) + 10000,
      avgSessionDuration: Math.floor(Math.random() * 600) + 120, // seconds
      bounceRate: Number((Math.random() * 40 + 20).toFixed(1)),
      conversions24h: Math.floor(Math.random() * 1000) + 200
    };

    const databaseData = {
      connections: {
        active: Math.floor(Math.random() * 50) + 10,
        idle: Math.floor(Math.random() * 100) + 50,
        max: 200,
        poolUtilization: Number((Math.random() * 40 + 40).toFixed(1))
      },
      queries: {
        perSecond: Math.floor(Math.random() * 1000) + 500,
        avgResponseTime: Math.floor(Math.random() * 100) + 20,
        slowQueries: Math.floor(Math.random() * 10),
        totalQueries24h: Math.floor(Math.random() * 1000000) + 500000
      },
      cache: {
        hitRate: Number((Math.random() * 20 + 80).toFixed(1)),
        missRate: Number((Math.random() * 20).toFixed(1)),
        size: Number((Math.random() * 2 + 1).toFixed(1)), // GB
        evictions: Math.floor(Math.random() * 1000)
      }
    };

    // Filter metrics based on request
    let filteredData: any = {};

    if (metrics.includes('performance') || metrics.length === 0) {
      filteredData.performance = performanceData;
    }
    if (metrics.includes('resources') || metrics.length === 0) {
      filteredData.resources = resourceData;
    }
    if (metrics.includes('application') || metrics.length === 0) {
      filteredData.application = applicationData;
    }
    if (metrics.includes('database') || metrics.length === 0) {
      filteredData.database = databaseData;
    }

    // If no specific metrics requested, return all
    if (metrics.length === 0) {
      filteredData = {
        performance: performanceData,
        resources: resourceData,
        application: applicationData,
        database: databaseData
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        timeframe,
        timestamp: new Date().toISOString(),
        ...filteredData
      }
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}