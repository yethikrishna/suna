import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function useBlinkTodos(authToken?: string) {
  const qc = useQueryClient()
  const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined

  const list = useQuery({
    queryKey: ['blink', 'todos'],
    queryFn: async () => {
      const res = await fetch('/api/blink/db/todos', { headers })
      const data = await res.json()
      if (!res.ok) throw data.error
      return data.todos
    },
  })

  const create = useMutation({
    mutationFn: async (input: { title: string; userId: string }) => {
      const res = await fetch('/api/blink/db/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(headers || {}) },
        body: JSON.stringify(input),
      })
      const data = await res.json()
      if (!res.ok) throw data.error
      return data.todo
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blink', 'todos'] }),
  })

  const update = useMutation({
    mutationFn: async (input: { id: string; title?: string; isCompleted?: boolean }) => {
      const res = await fetch('/api/blink/db/todos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(headers || {}) },
        body: JSON.stringify(input),
      })
      const data = await res.json()
      if (!res.ok) throw data.error
      return data.todo
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blink', 'todos'] }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/blink/db/todos?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: headers,
      })
      const data = await res.json()
      if (!res.ok) throw data.error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blink', 'todos'] }),
  })

  return { list, create, update, remove }
}