import { NextResponse } from 'next/server'
import { createBlinkServerClient } from '@/lib/blink/server'
import { handleBlinkError } from '@/lib/blink/errors'

export async function POST(req: Request) {
  try {
    const jwt = req.headers.get('authorization')?.replace('Bearer ', '')
    const blink = createBlinkServerClient(jwt || undefined)
    const body = await req.json()
    const result = await blink.data.screenshot(body.url)
    return NextResponse.json(result)
  } catch (err) {
    const e = handleBlinkError(err)
    return NextResponse.json({ error: e }, { status: 400 })
  }
}