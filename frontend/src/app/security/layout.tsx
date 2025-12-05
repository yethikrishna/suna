/**
 * y0 Security & Compliance Layout
 * Layout for security and compliance pages
 */

import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Security & Compliance | y0 Platform',
  description: 'Enterprise-grade security monitoring and compliance management',
}

export default function SecurityLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}