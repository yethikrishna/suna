import { useMutation } from '@tanstack/react-query'

export function useGenerateText(authToken?: string) {
  return useMutation({
    mutationFn: async (input: { prompt: string; search?: boolean; maxTokens?: number; maxSteps?: number }) => {
      const res = await fetch('/api/blink/ai/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify(input),
      })
      const data = await res.json()
      if (!res.ok) throw data.error
      return data
    },
  })
}

export function useModifyImage(authToken?: string) {
  return useMutation({
    mutationFn: async (input: { images: string[]; prompt: string }) => {
      const res = await fetch('/api/blink/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify(input),
      })
      const data = await res.json()
      if (!res.ok) throw data.error
      return data
    },
  })
}