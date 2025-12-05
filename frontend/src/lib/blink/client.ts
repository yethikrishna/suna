import { createClient } from '@blinkdotnew/sdk'

let client: ReturnType<typeof createClient> | null = null

export function getBlinkClient() {
  if (client) return client
  const projectId = process.env.NEXT_PUBLIC_BLINK_PROJECT_ID as string
  client = createClient({
    projectId,
    authRequired: false,
    auth: {
      mode: (process.env.NEXT_PUBLIC_BLINK_AUTH_MODE as 'managed' | 'headless') || 'headless',
      // Enable all providers for user flexibility
    },
    baseUrl: process.env.NEXT_PUBLIC_BLINK_CORE_URL,
  })
  return client
}

export const blink = getBlinkClient()

// Export for direct use throughout the app
export { createClient } from '@blinkdotnew/sdk'
export type {
  BlinkClient,
  BlinkUser,
  AuthError,
  DatabaseError,
  AIError,
  DataError,
  StorageError,
  RealtimeError,
  NotificationsError
} from '@blinkdotnew/sdk'