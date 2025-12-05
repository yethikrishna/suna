import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const severity = searchParams.get('severity') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50');

    // Generate mock alerts with realistic data
    const alertTypes = [
      {
        title: 'High Response Time',
        message: 'API response time is exceeding 2 seconds threshold',
        metric: 'response_time',
        source: 'api',
        severity: 'warning' as const
      },
      {
        title: 'Error Rate Spike',
        message: 'Error rate increased significantly in the last hour',
        metric: 'error_rate',
        source: 'api',
        severity: 'error' as const
      },
      {
        title: 'Database Connection Issues',
        message: 'Database connection pool exhaustion detected',
        metric: 'database_connections',
        source: 'database',
        severity: 'critical' as const
      },
      {
        title: 'High Memory Usage',
        message: 'Memory usage exceeds 85% threshold',
        metric: 'memory_usage',
        source: 'system',
        severity: 'warning' as const
      },
      {
        title: 'Cache Service Degraded',
        message: 'Cache service showing slower response times',
        metric: 'cache_response_time',
        source: 'cache',
        severity: 'warning' as const
      },
      {
        title: 'SSL Certificate Expiring Soon',
        message: 'SSL certificate will expire in 7 days',
        metric: 'certificate_expiry',
        source: 'security',
        severity: 'warning' as const
      },
      {
        title: 'API Rate Limit Reached',
        message: 'API rate limit threshold exceeded',
        metric: 'rate_limit',
        source: 'api',
        severity: 'error' as const
      },
      {
        title: 'Low Disk Space',
        message: 'Available disk space is below 10%',
        metric: 'disk_usage',
        source: 'storage',
        severity: 'critical' as const
      }
    ];

    const statuses = ['open', 'acknowledged', 'resolved', 'suppressed'] as const;

    const alerts = Array.from({ length: Math.min(limit, 100) }, (_, i) => {
      const alertType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
      const alertStatus = statuses[Math.floor(Math.random() * statuses.length)];
      const triggeredTime = Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000; // Random time in last week

      const alert = {
        id: `alert_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
        ruleId: `rule_${Math.floor(Math.random() * 100)}`,
        title: alertType.title,
        message: alertType.message,
        severity: alertType.severity,
        status: status === 'all' ? alertStatus : status,
        source: alertType.source,
        metric: alertType.metric,
        value: Math.floor(Math.random() * 1000) + 100,
        threshold: Math.floor(Math.random() * 500) + 50,
        triggeredAt: new Date(triggeredTime),
        metadata: {
          tags: ['production', 'api'],
          environment: 'production',
          service: 'y0-platform',
          instance: `instance-${Math.floor(Math.random() * 10) + 1}`
        },
        escalationLevel: Math.floor(Math.random() * 3)
      };

      // Add acknowledgment and resolution data if applicable
      if (alertStatus === 'acknowledged' || alertStatus === 'resolved') {
        alert.acknowledgedAt = new Date(triggeredTime + Math.random() * 60 * 60 * 1000);
        alert.acknowledgedBy = `user-${Math.floor(Math.random() * 100)}`;
      }

      if (alertStatus === 'resolved') {
        alert.resolvedAt = new Date(triggeredTime + Math.random() * 2 * 60 * 60 * 1000);
        alert.resolvedBy = `user-${Math.floor(Math.random() * 100)}`;
        alert.resolution = 'Issue resolved by restarting affected service';
      }

      if (alert.triggeredAt) {
        alert.duration = Date.now() - alert.triggeredAt.getTime();
      }

      return alert;
    }).filter(alert => severity === 'all' || alert.severity === severity);

    const summary = {
      total: alerts.length,
      open: alerts.filter(alert => alert.status === 'open').length,
      acknowledged: alerts.filter(alert => alert.status === 'acknowledged').length,
      resolved: alerts.filter(alert => alert.status === 'resolved').length,
      suppressed: alerts.filter(alert => alert.status === 'suppressed').length,
      bySeverity: {
        info: alerts.filter(alert => alert.severity === 'info').length,
        warning: alerts.filter(alert => alert.severity === 'warning').length,
        error: alerts.filter(alert => alert.severity === 'error').length,
        critical: alerts.filter(alert => alert.severity === 'critical').length
      }
    };

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        summary,
        lastUpdated: new Date().toISOString()
      },
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, alertId, userId, resolution } = body;

    // Simulate alert management operations
    switch (action) {
      case 'acknowledge':
        await new Promise(resolve => setTimeout(resolve, 100));
        return NextResponse.json({
          success: true,
          data: {
            alertId,
            status: 'acknowledged',
            acknowledgedAt: new Date().toISOString(),
            acknowledgedBy: userId
          }
        });

      case 'resolve':
        await new Promise(resolve => setTimeout(resolve, 150));
        return NextResponse.json({
          success: true,
          data: {
            alertId,
            status: 'resolved',
            resolvedAt: new Date().toISOString(),
            resolvedBy: userId,
            resolution
          }
        });

      case 'suppress':
        await new Promise(resolve => setTimeout(resolve, 100));
        return NextResponse.json({
          success: true,
          data: {
            alertId,
            status: 'suppressed',
            suppressedAt: new Date().toISOString(),
            suppressedBy: userId
          }
        });

      case 'escalate':
        await new Promise(resolve => setTimeout(resolve, 200));
        return NextResponse.json({
          success: true,
          data: {
            alertId,
            escalationLevel: (body.currentLevel || 0) + 1,
            escalatedAt: new Date().toISOString(),
            escalatedBy: userId
          }
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error managing alert:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to manage alert' },
      { status: 500 }
    );
  }
}