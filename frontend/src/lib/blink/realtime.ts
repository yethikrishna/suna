import { blink } from '@/lib/blink/client'
import { handleBlinkError } from './errors'

export function getChannel(id: string) {
  return blink.realtime.channel(id)
}

export async function subscribeChannel(channel: ReturnType<typeof getChannel>, opts: { userId: string; metadata?: Record<string, any> }) {
  try {
    await channel.subscribe({ userId: opts.userId, metadata: opts.metadata })
  } catch (err) {
    throw handleBlinkError(err)
  }
}

export async function publish(channel: ReturnType<typeof getChannel>, type: string, data: any, opts?: { userId?: string }) {
  try {
    await channel.publish(type, data, opts)
  } catch (err) {
    throw handleBlinkError(err)
  }
}

export function onMessage(channel: ReturnType<typeof getChannel>, cb: (message: any) => void) {
  channel.onMessage(cb)
}

export function onPresence(channel: ReturnType<typeof getChannel>, cb: (users: any[]) => void) {
  channel.onPresence(cb)
}

export function unsubscribe(channel: ReturnType<typeof getChannel>) {
  channel.unsubscribe()
}