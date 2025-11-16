import {
  BlinkAuthError,
  BlinkAIError,
  BlinkStorageError,
  BlinkDataError,
  BlinkRealtimeError,
  BlinkNotificationsError,
} from '@blinkdotnew/sdk'

type NormalizedError = {
  type:
    | 'auth'
    | 'ai'
    | 'storage'
    | 'data'
    | 'realtime'
    | 'notifications'
    | 'unknown'
  code?: string
  message: string
}

export function handleBlinkError(err: unknown): NormalizedError {
  if (err instanceof BlinkAuthError) return { type: 'auth', code: err.code, message: err.message }
  if (err instanceof BlinkAIError) return { type: 'ai', message: (err as Error).message }
  if (err instanceof BlinkStorageError) return { type: 'storage', message: (err as Error).message }
  if (err instanceof BlinkDataError) return { type: 'data', message: (err as Error).message }
  if (err instanceof BlinkRealtimeError) return { type: 'realtime', message: (err as Error).message }
  if (err instanceof BlinkNotificationsError) return { type: 'notifications', message: (err as Error).message }
  const fallback = err as Error
  return { type: 'unknown', message: fallback?.message || 'Unknown error' }
}