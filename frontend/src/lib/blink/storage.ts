import { blink } from '@/lib/blink/client'
import { handleBlinkError } from './errors'

export async function upload(file: File, pathPrefix: string) {
  try {
    const ext = file.name.split('.').pop()
    const { publicUrl } = await blink.storage.upload(
      file,
      `${pathPrefix}/${Date.now()}.${ext}`,
      { upsert: true },
    )
    return { publicUrl }
  } catch (err) {
    throw handleBlinkError(err)
  }
}