'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

type SupabaseCredentialsContextType = {
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
  setSupabaseCredentials: (url: string, key: string) => void;
};

const SupabaseCredentialsContext = createContext<SupabaseCredentialsContextType | undefined>(undefined);

export const SupabaseCredentialsProvider = ({ children }: { children: ReactNode }) => {
  const [supabaseUrl, setSupabaseUrl] = useState<string | undefined>(() => {
    // Initialize from localStorage if available
    if (typeof window !== 'undefined') {
      return localStorage.getItem('supabaseUrl') || undefined;
    }
    return undefined;
  });
  const [supabaseAnonKey, setSupabaseAnonKey] = useState<string | undefined>(() => {
    // Initialize from localStorage if available
    if (typeof window !== 'undefined') {
      return localStorage.getItem('supabaseAnonKey') || undefined;
    }
    return undefined;
  });

  const setSupabaseCredentials = (url: string, key: string) => {
    setSupabaseUrl(url);
    setSupabaseAnonKey(key);
    if (typeof window !== 'undefined') {
      localStorage.setItem('supabaseUrl', url);
      localStorage.setItem('supabaseAnonKey', key);
    }
  };

  return (
    <SupabaseCredentialsContext.Provider value={{
      supabaseUrl,
      supabaseAnonKey,
      setSupabaseCredentials,
    }}>
      {children}
    </SupabaseCredentialsContext.Provider>
  );
};

export const useSupabaseCredentials = () => {
  const context = useContext(SupabaseCredentialsContext);
  if (context === undefined) {
    throw new Error('useSupabaseCredentials must be used within a SupabaseCredentialsProvider');
  }
  return context;
};