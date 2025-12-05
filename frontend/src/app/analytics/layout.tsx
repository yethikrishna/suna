/**
 * y0 Analytics Layout
 * Layout for analytics pages
 */

import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Analytics | y0 Platform',
  description: 'Analytics and insights for the y0 platform',
}

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}