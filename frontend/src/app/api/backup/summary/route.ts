import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Generate backup summary data
    const totalConfigs = Math.floor(Math.random() * 10) + 5
    const activeJobs = Math.floor(Math.random() * 5)
    const completedBackups = Math.floor(Math.random() * 200) + 100
    const failedBackups = Math.floor(Math.random() * 10) + 1
    const totalSize = Math.floor(Math.random() * 5) + 1 // TB
    const averageDuration = Math.floor(Math.random() * 3600) + 600 // 10-70 minutes
    const successRate = ((completedBackups / (completedBackups + failedBackups)) * 100).toFixed(1)

    const summary = {
      totalConfigs,
      activeJobs,
      completedBackups,
      failedBackups,
      totalSize: totalSize * 1024 * 1024 * 1024 * 1024, // Convert TB to bytes
      averageDuration: averageDuration * 1000, // Convert to milliseconds
      successRate: parseFloat(successRate),
      lastBackup: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
      nextScheduledBackup: new Date(Date.now() + Math.random() * 12 * 60 * 60 * 1000)
    }

    return NextResponse.json({
      success: true,
      data: summary
    })
  } catch (error) {
    console.error('Error fetching backup summary:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch backup summary' },
      { status: 500 }
    )
  }
}