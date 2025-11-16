import { blink } from '@/lib/blink/client'

export function log(event: string, data?: Record<string, any>) {
  try {
    blink.analytics.log(event, data || {})
  } catch {}
}

export function enable() {
  try {
    blink.analytics.enable()
  } catch {}
}

export function disable() {
  try {
    blink.analytics.disable()
  } catch {}
}

export function isEnabled() {
  try {
    return blink.analytics.isEnabled()
  } catch {
    return false
  }
}

export function clearAttribution() {
  try {
    blink.analytics.clearAttribution()
  } catch {}
}