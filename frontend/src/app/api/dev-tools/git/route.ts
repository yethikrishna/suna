import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Simulate fetching git statistics
    const gitStats = {
      branches: {
        main: { ahead: 0, behind: 0, lastCommit: '2 hours ago' },
        develop: { ahead: 12, behind: 3, lastCommit: '30 minutes ago' },
        'feature/ai-optimizer': { ahead: 5, behind: 0, lastCommit: '1 hour ago' },
        'bugfix/security-patch': { ahead: 2, behind: 0, lastCommit: '4 hours ago' },
      },
      commits: {
        today: Math.floor(Math.random() * 10) + 5, // 5-15 commits today
        thisWeek: Math.floor(Math.random() * 50) + 30, // 30-80 commits this week
        thisMonth: Math.floor(Math.random() * 200) + 150, // 150-350 commits this month
        total: Math.floor(Math.random() * 1000) + 2000, // 2000-3000 total commits
      },
      contributors: Math.floor(Math.random() * 5) + 8, // 8-13 contributors
      pullRequests: {
        open: Math.floor(Math.random() * 5) + 1, // 1-6 open PRs
        merged: Math.floor(Math.random() * 50) + 20, // 20-70 merged PRs
        closed: Math.floor(Math.random() * 10) + 5, // 5-15 closed PRs
      },
      issues: {
        open: Math.floor(Math.random() * 20) + 5, // 5-25 open issues
        closed: Math.floor(Math.random() * 100) + 50, // 50-150 closed issues
      },
      lastSync: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: gitStats,
    });
  } catch (error) {
    console.error('Error fetching git statistics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch git statistics' },
      { status: 500 }
    );
  }
}