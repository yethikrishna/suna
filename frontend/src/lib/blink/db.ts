import { blink } from '@/lib/blink/client'
import { handleBlinkError } from './errors'

export async function listTodos(opts: { userId?: string; limit?: number; orderBy?: { createdAt?: 'asc' | 'desc' } }) {
  try {
    const todos = await blink.db.todos.list({
      where: opts.userId ? { userId: opts.userId } : undefined,
      orderBy: opts.orderBy,
      limit: opts.limit ?? 20,
    })
    return { todos }
  } catch (err) {
    throw handleBlinkError(err)
  }
}

export async function createTodo(input: { title: string; userId: string }) {
  try {
    const todo = await blink.db.todos.create({
      title: input.title,
      userId: input.userId,
      isCompleted: false,
      createdAt: new Date(),
    })
    return { todo }
  } catch (err) {
    throw handleBlinkError(err)
  }
}

export async function updateTodo(input: { id: string; title?: string; isCompleted?: boolean }) {
  try {
    const todo = await blink.db.todos.update({ id: input.id }, {
      title: input.title,
      isCompleted: input.isCompleted,
    })
    return { todo }
  } catch (err) {
    throw handleBlinkError(err)
  }
}

export async function deleteTodo(id: string) {
  try {
    await blink.db.todos.delete({ id })
    return { success: true }
  } catch (err) {
    throw handleBlinkError(err)
  }
}