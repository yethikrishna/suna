/**
 * y0 AI Workflow Optimizer Page
 * Main AI workflow optimizer page
 */

import WorkflowOptimizerDashboard from '@/components/ai/workflow-optimizer-dashboard'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Workflow Optimizer | y0 Platform',
  description: 'AI-powered workflow optimization and intelligent automation',
}

export default function AIOptimizerPage() {
  return (
    <div className="container mx-auto">
      <WorkflowOptimizerDashboard />
    </div>
  )
}