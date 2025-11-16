import { NextResponse } from 'next/server'
import { createBlinkServerClient } from '@/lib/blink/server'
import { handleBlinkError } from '@/lib/blink/errors'

export async function POST(req: Request) {
  try {
    const jwt = req.headers.get('authorization')?.replace('Bearer ', '')
    const blink = createBlinkServerClient(jwt || undefined)
    const formData = await req.formData()
    const file = formData.get('file') as File
    const pathPrefix = (formData.get('pathPrefix') as string) || 'uploads'
    const ext = file.name.split('.').pop()
    const { publicUrl } = await blink.storage.upload(file, `${pathPrefix}/${Date.now()}.${ext}`, { upsert: true })
    return NextResponse.json({ publicUrl })
  } catch (err) {
    const e = handleBlinkError(err)
    return NextResponse.json({ error: e }, { status: 400 })
  }
}