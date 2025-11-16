import { blink } from '@/lib/blink/client'
import { handleBlinkError } from './errors'

export async function sendEmail(input: { to: string; from?: string; subject: string; html?: string; text?: string }) {
  try {
    const from = input.from || process.env.BLINK_NOTIFICATIONS_FROM || 'welcome@localhost'
    const result = await blink.notifications.email({
      to: input.to,
      from,
      subject: input.subject,
      html: input.html,
      text: input.text,
    })
    return result
  } catch (err) {
    throw handleBlinkError(err)
  }
}