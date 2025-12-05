/**
 * y0 Analytics Page
 * Main analytics dashboard page
 */

import AnalyticsDashboard from '@/components/analytics/analytics-dashboard'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Analytics | y0 Platform',
  description: 'Real-time insights and performance metrics for the y0 platform',
}

export default function AnalyticsPage() {
  return (
    <div className="container mx-auto">
      <AnalyticsDashboard />
    </div>
  )
}