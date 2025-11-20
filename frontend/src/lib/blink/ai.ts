import { blink } from '@/lib/blink/client'
import { handleBlinkError } from './errors'

export async function generateText(input: { prompt: string; search?: boolean; maxTokens?: number; maxSteps?: number }) {
  try {
    const result = await blink.ai.generateText({
      prompt: input.prompt,
      search: input.search,
      maxTokens: input.maxTokens,
      maxSteps: input.maxSteps,
    })
    return result
  } catch (err) {
    throw handleBlinkError(err)
  }
}

export async function modifyImage(input: { images: string[]; prompt: string }) {
  try {
    const result = await blink.ai.modifyImage({ images: input.images, prompt: input.prompt })
    return result
  } catch (err) {
    throw handleBlinkError(err)
  }
}

export async function generateSpeech(input: { text: string; voice?: string }) {
  try {
    const result = await blink.ai.generateSpeech({ text: input.text, voice: (input.voice as any) || 'nova' })
    return result
  } catch (err) {
    throw handleBlinkError(err)
  }
}