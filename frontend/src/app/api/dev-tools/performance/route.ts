import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Simulate fetching performance metrics
    const performance = {
      webVitals: {
        lcp: Math.floor(Math.random() * 500) + 1500, // 1500-2000ms
        fid: Math.floor(Math.random() * 50) + 20, // 20-70ms
        cls: Number((Math.random() * 0.1 + 0.05).toFixed(3)), // 0.05-0.15
        fcp: Math.floor(Math.random() * 300) + 1200, // 1200-1500ms
        ttfb: Math.floor(Math.random() * 100) + 100, // 100-200ms
      },
      apiPerformance: {
        averageResponseTime: Math.floor(Math.random() * 200) + 300, // 300-500ms
        requestsPerSecond: Math.floor(Math.random() * 100) + 200, // 200-300 RPS
        errorRate: Number((Math.random() * 0.01).toFixed(4)), // 0-1%
        p95ResponseTime: Math.floor(Math.random() * 500) + 800, // 800-1300ms
        p99ResponseTime: Math.floor(Math.random() * 1000) + 1500, // 1500-2500ms
      },
      database: {
        queryTime: Math.floor(Math.random() * 50) + 20, // 20-70ms
        connectionPool: Math.floor(Math.random() * 20) + 60, // 60-80% utilized
        slowQueries: Math.floor(Math.random() * 5), // 0-5 slow queries
        indexUsage: Number((Math.random() * 0.1 + 0.85).toFixed(2)), // 85-95%
      },
      cache: {
        hitRate: Number((Math.random() * 0.2 + 0.75).toFixed(2)), // 75-95%
        evictionRate: Number((Math.random() * 0.05).toFixed(3)), // 0-5%
        memoryUsage: Number((Math.random() * 0.3 + 0.5).toFixed(2)), // 50-80%
        responseTime: Math.floor(Math.random() * 10) + 5, // 5-15ms
      },
      lastOptimized: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: performance,
    });
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch performance metrics' },
      { status: 500 }
    );
  }
}