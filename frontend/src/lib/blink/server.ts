import { createClient } from '@blinkdotnew/sdk'

export function createBlinkServerClient(jwt?: string) {
  const projectId = process.env.NEXT_PUBLIC_BLINK_PROJECT_ID as string
  const client = createClient({
    projectId,
    auth: { mode: 'headless' },
    // baseUrl: process.env.NEXT_PUBLIC_BLINK_CORE_URL,
  })
  if (jwt) client.auth.setToken(jwt)
  return client
}