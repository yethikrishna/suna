import { blink } from '@/lib/blink/client'
import { handleBlinkError } from './errors'

export async function search(query: string, opts: { type?: 'news' | 'images' | 'shopping'; language?: string; limit?: number } = {}) {
  try {
    const result = await blink.data.search(query, opts as any)
    return result
  } catch (err) {
    throw handleBlinkError(err)
  }
}

export async function scrape(url: string) {
  try {
    const result = await blink.data.scrape(url)
    return result
  } catch (err) {
    throw handleBlinkError(err)
  }
}

export async function screenshot(url: string) {
  try {
    const result = await blink.data.screenshot(url)
    return result
  } catch (err) {
    throw handleBlinkError(err)
  }
}

export async function extractFromUrl(url: string) {
  try {
    const result = await blink.data.extractFromUrl(url)
    return result
  } catch (err) {
    throw handleBlinkError(err)
  }
}

export async function secureFetch(config: {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: any
}) {
  try {
    const result = await blink.data.fetch(config as any)
    return result
  } catch (err) {
    throw handleBlinkError(err)
  }
}