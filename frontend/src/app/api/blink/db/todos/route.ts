import { NextResponse } from 'next/server'
import { createBlinkServerClient } from '@/lib/blink/server'
import { handleBlinkError } from '@/lib/blink/errors'

export async function GET(req: Request) {
  try {
    const jwt = req.headers.get('authorization')?.replace('Bearer ', '')
    const blink = createBlinkServerClient(jwt || undefined)
    const user = await blink.auth.me().catch(() => null)
    const todos = await blink.db.todos.list({
      where: user?.id ? { userId: user.id } : undefined,
      orderBy: { createdAt: 'desc' },
      limit: 20,
    })
    return NextResponse.json({ todos })
  } catch (err) {
    const e = handleBlinkError(err)
    return NextResponse.json({ error: e }, { status: 400 })
  }
}

export async function POST(req: Request) {
  try {
    const jwt = req.headers.get('authorization')?.replace('Bearer ', '')
    const blink = createBlinkServerClient(jwt || undefined)
    const body = await req.json()
    const todo = await blink.db.todos.create({
      title: body.title,
      userId: body.userId,
      isCompleted: false,
      createdAt: new Date(),
    })
    return NextResponse.json({ todo })
  } catch (err) {
    const e = handleBlinkError(err)
    return NextResponse.json({ error: e }, { status: 400 })
  }
}

export async function PATCH(req: Request) {
  try {
    const jwt = req.headers.get('authorization')?.replace('Bearer ', '')
    const blink = createBlinkServerClient(jwt || undefined)
    const body = await req.json()
    const todo = await blink.db.todos.update({ id: body.id }, {
      title: body.title,
      isCompleted: body.isCompleted,
    })
    return NextResponse.json({ todo })
  } catch (err) {
    const e = handleBlinkError(err)
    return NextResponse.json({ error: e }, { status: 400 })
  }
}

export async function DELETE(req: Request) {
  try {
    const jwt = req.headers.get('authorization')?.replace('Bearer ', '')
    const blink = createBlinkServerClient(jwt || undefined)
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id') as string
    await blink.db.todos.delete({ id })
    return NextResponse.json({ success: true })
  } catch (err) {
    const e = handleBlinkError(err)
    return NextResponse.json({ error: e }, { status: 400 })
  }
}