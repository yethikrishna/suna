import { createClient } from '@blinkdotnew/sdk'

let client: ReturnType<typeof createClient> | null = null

export function getBlinkClient() {
  if (client) return client
  const projectId = process.env.NEXT_PUBLIC_BLINK_PROJECT_ID as string
  client = createClient({
    projectId,
    authRequired: false,
    auth: { mode: (process.env.NEXT_PUBLIC_BLINK_AUTH_MODE as 'managed' | 'headless') || 'headless' },
    baseUrl: process.env.NEXT_PUBLIC_BLINK_CORE_URL,
  })
  return client
}

export const blink = getBlinkClient()