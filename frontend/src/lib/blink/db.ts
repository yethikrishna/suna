import { blink } from '@/lib/blink/client'
import { handleBlinkError } from './errors'

// Export the blink db for direct access
export const db = blink.db

// Users operations
export async function getUser(userId: string) {
  try {
    const users = await blink.db.users.list({ where: { id: userId }, limit: 1 })
    return users[0] || null
  } catch (err) {
    throw handleBlinkError(err)
  }
}

export async function createUser(data: { email: string; name?: string }) {
  try {
    return await blink.db.users.create(data)
  } catch (err) {
    throw handleBlinkError(err)
  }
}

export async function updateUser(userId: string, updates: any) {
  try {
    return await blink.db.users.update(userId, updates)
  } catch (err) {
    throw handleBlinkError(err)
  }
}

// Projects operations
export async function listProjects(opts?: { userId?: string; limit?: number }) {
  try {
    return await blink.db.projects.list({
      where: opts?.userId ? { userId: opts.userId } : undefined,
      limit: opts?.limit ?? 50,
      orderBy: { createdAt: 'desc' }
    })
  } catch (err) {
    throw handleBlinkError(err)
  }
}

export async function createProject(data: { name: string; userId: string; description?: string }) {
  try {
    return await blink.db.projects.create(data)
  } catch (err) {
    throw handleBlinkError(err)
  }
}

export async function updateProject(projectId: string, updates: any) {
  try {
    return await blink.db.projects.update(projectId, updates)
  } catch (err) {
    throw handleBlinkError(err)
  }
}

export async function deleteProject(projectId: string) {
  try {
    await blink.db.projects.delete(projectId)
    return { success: true }
  } catch (err) {
    throw handleBlinkError(err)
  }
}

// Threads operations
export async function listThreads(opts?: { projectId?: string; limit?: number }) {
  try {
    return await blink.db.threads.list({
      where: opts?.projectId ? { projectId: opts.projectId } : undefined,
      limit: opts?.limit ?? 50,
      orderBy: { createdAt: 'desc' }
    })
  } catch (err) {
    throw handleBlinkError(err)
  }
}

export async function createThread(data: { title: string; projectId: string }) {
  try {
    return await blink.db.threads.create(data)
  } catch (err) {
    throw handleBlinkError(err)
  }
}

export async function updateThread(threadId: string, updates: any) {
  try {
    return await blink.db.threads.update(threadId, updates)
  } catch (err) {
    throw handleBlinkError(err)
  }
}

export async function deleteThread(threadId: string) {
  try {
    await blink.db.threads.delete(threadId)
    return { success: true }
  } catch (err) {
    throw handleBlinkError(err)
  }
}

// Messages operations
export async function listMessages(opts?: { threadId?: string; limit?: number }) {
  try {
    return await blink.db.messages.list({
      where: opts?.threadId ? { threadId: opts.threadId } : undefined,
      limit: opts?.limit ?? 100,
      orderBy: { createdAt: 'asc' }
    })
  } catch (err) {
    throw handleBlinkError(err)
  }
}

export async function createMessage(data: { content: string; threadId: string; role: string; userId?: string }) {
  try {
    return await blink.db.messages.create(data)
  } catch (err) {
    throw handleBlinkError(err)
  }
}

export async function deleteMessage(messageId: string) {
  try {
    await blink.db.messages.delete(messageId)
    return { success: true }
  } catch (err) {
    throw handleBlinkError(err)
  }
}

// Agent runs operations
export async function listAgentRuns(opts?: { threadId?: string; limit?: number }) {
  try {
    return await blink.db.agent_runs.list({
      where: opts?.threadId ? { threadId: opts.threadId } : undefined,
      limit: opts?.limit ?? 50,
      orderBy: { createdAt: 'desc' }
    })
  } catch (err) {
    throw handleBlinkError(err)
  }
}

export async function createAgentRun(data: { threadId: string; status: string; model?: string }) {
  try {
    return await blink.db.agent_runs.create(data)
  } catch (err) {
    throw handleBlinkError(err)
  }
}

export async function updateAgentRun(runId: string, updates: any) {
  try {
    return await blink.db.agent_runs.update(runId, updates)
  } catch (err) {
    throw handleBlinkError(err)
  }
}

// Generic table operations for flexibility
export async function queryTable<T = any>(
  tableName: string,
  options?: {
    where?: Record<string, any>
    orderBy?: Record<string, 'asc' | 'desc'>
    limit?: number
  }
) {
  const table = (blink.db as any)[tableName]
  if (!table) throw new Error(`Table ${tableName} not found`)
  return table.list(options) as Promise<T[]>
}

export async function insertRecord<T = any>(
  tableName: string,
  data: Record<string, any>
) {
  const table = (blink.db as any)[tableName]
  if (!table) throw new Error(`Table ${tableName} not found`)
  return table.create(data) as Promise<T>
}

export async function updateRecord<T = any>(
  tableName: string,
  id: string,
  updates: Record<string, any>
) {
  const table = (blink.db as any)[tableName]
  if (!table) throw new Error(`Table ${tableName} not found`)
  return table.update(id, updates) as Promise<T>
}

export async function deleteRecord(
  tableName: string,
  id: string
) {
  const table = (blink.db as any)[tableName]
  if (!table) throw new Error(`Table ${tableName} not found`)
  return table.delete(id)
}