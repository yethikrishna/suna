import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50');

    // Simulate fetching recent log entries
    const logLevels = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
    const services = ['api', 'web', 'worker', 'auth', 'analytics'];
    const messages = [
      'User authentication successful',
      'Database query executed successfully',
      'Cache hit for key: user_session_*',
      'API request processed in 125ms',
      'Background job completed',
      'Email notification sent',
      'File upload completed',
      'Security scan passed',
      'Performance metric recorded',
      'User session created',
    ];

    const logs = Array.from({ length: Math.min(limit, 100) }, (_, i) => {
      const timestamp = new Date(Date.now() - i * 60000); // 1 minute intervals
      const randomLevel = level === 'all'
        ? logLevels[Math.floor(Math.random() * logLevels.length)]
        : level.toUpperCase();
      const service = services[Math.floor(Math.random() * services.length)];
      const message = messages[Math.floor(Math.random() * messages.length)];

      return {
        id: `log_${Date.now() - i * 60000}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: timestamp.toISOString(),
        level: randomLevel,
        service,
        message,
        metadata: Math.random() > 0.7 ? {
          userId: Math.floor(Math.random() * 1000),
          requestId: Math.random().toString(36).substr(2, 12),
          duration: Math.floor(Math.random() * 500) + 50,
        } : null,
      };
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const summary = {
      total: logs.length,
      info: logs.filter(log => log.level === 'INFO').length,
      warn: logs.filter(log => log.level === 'WARN').length,
      error: logs.filter(log => log.level === 'ERROR').length,
      debug: logs.filter(log => log.level === 'DEBUG').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        logs,
        summary,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}