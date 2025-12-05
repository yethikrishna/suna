/**
 * y0 Security & Compliance Page
 * Main security and compliance management page
 */

import ComplianceDashboard from '@/components/security/compliance-dashboard'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Security & Compliance | y0 Platform',
  description: 'Enterprise-grade security monitoring and compliance management',
}

export default function SecurityPage() {
  return (
    <div className="container mx-auto">
      <ComplianceDashboard />
    </div>
  )
}