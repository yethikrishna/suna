'use client'

import { useState } from 'react'
import { useBlinkClient } from '@/contexts/BlinkContext'
import { handleBlinkError } from '@/lib/blink/errors'

const BlinkDemoPage = () => {
  const blink = useBlinkClient()
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const testDatabase = async () => {
    try {
      setLoading(true)
      setError(null)
      const todos = await blink.db.todos.list({ limit: 5 })
      setResult(JSON.stringify(todos, null, 2))
    } catch (err) {
      const normalizedError = handleBlinkError(err)
      setError(`${normalizedError.type}: ${normalizedError.message}`)
    } finally {
      setLoading(false)
    }
  }

  const testAI = async () => {
    try {
      setLoading(true)
      setError(null)
      const { text } = await blink.ai.generateText({ prompt: 'Say hello in 5 languages' })
      setResult(text)
    } catch (err) {
      const normalizedError = handleBlinkError(err)
      setError(`${normalizedError.type}: ${normalizedError.message}`)
    } finally {
      setLoading(false)
    }
  }

  const testData = async () => {
    try {
      setLoading(true)
      setError(null)
      const searchResults = await blink.data.search('Blink SDK', { type: 'web' })
      setResult(JSON.stringify(searchResults, null, 2))
    } catch (err) {
      const normalizedError = handleBlinkError(err)
      setError(`${normalizedError.type}: ${normalizedError.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8">Blink SDK Demo</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <button
          onClick={testDatabase}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition duration-200 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test Database'}
        </button>
        <button
          onClick={testAI}
          disabled={loading}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition duration-200 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test AI'}
        </button>
        <button
          onClick={testData}
          disabled={loading}
          className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded transition duration-200 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test Data Search'}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="bg-gray-100 border border-gray-300 rounded p-4">
          <h2 className="text-xl font-semibold mb-2">Result:</h2>
          <pre className="whitespace-pre-wrap break-all">{result}</pre>
        </div>
      )}
    </div>
  )
}

export default BlinkDemoPage