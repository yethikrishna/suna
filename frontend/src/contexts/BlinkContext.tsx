'use client'

import React, { createContext, useContext, useEffect, useMemo } from 'react'
import { blink } from '@/lib/blink/client'

type BlinkContextValue = {
  blink: typeof blink
}

const BlinkContext = createContext<BlinkContextValue | undefined>(undefined)

export function BlinkProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => ({ blink }), [])

  useEffect(() => {
    try {
      blink.analytics.enable()
    } catch {}
  }, [])

  return <BlinkContext.Provider value={value}>{children}</BlinkContext.Provider>
}

export function useBlink() {
  const ctx = useContext(BlinkContext)
  if (!ctx) throw new Error('useBlink must be used within BlinkProvider')
  return ctx
}