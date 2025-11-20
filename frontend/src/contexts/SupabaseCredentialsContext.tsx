'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

type SupabaseCredentialsContextType = {
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
  setSupabaseCredentials: (url: string, key: string) => void;
};

const SupabaseCredentialsContext = createContext<SupabaseCredentialsContextType | undefined>(undefined);

// 前端-only 模式下的默认模拟凭证
const DEFAULT_SUPABASE_URL = 'https://mock-supabase-url.example.com';
const DEFAULT_SUPABASE_ANON_KEY = 'mock-supabase-anon-key';

export const SupabaseCredentialsProvider = ({ children }: { children: ReactNode }) => {
  const [supabaseUrl, setSupabaseUrl] = useState<string | undefined>(() => {
    // 首先检查 localStorage
    if (typeof window !== 'undefined') {
      const storedUrl = localStorage.getItem('supabaseUrl');
      if (storedUrl) {
        return storedUrl;
      }
      // 前端-only 模式：提供默认的模拟 URL
      localStorage.setItem('supabaseUrl', DEFAULT_SUPABASE_URL);
    }
    return DEFAULT_SUPABASE_URL;
  });
  
  const [supabaseAnonKey, setSupabaseAnonKey] = useState<string | undefined>(() => {
    // 首先检查 localStorage
    if (typeof window !== 'undefined') {
      const storedKey = localStorage.getItem('supabaseAnonKey');
      if (storedKey) {
        return storedKey;
      }
      // 前端-only 模式：提供默认的模拟密钥
      localStorage.setItem('supabaseAnonKey', DEFAULT_SUPABASE_ANON_KEY);
    }
    return DEFAULT_SUPABASE_ANON_KEY;
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
    // 前端-only 模式：提供一个默认的上下文，避免错误
    return {
      supabaseUrl: DEFAULT_SUPABASE_URL,
      supabaseAnonKey: DEFAULT_SUPABASE_ANON_KEY,
      setSupabaseCredentials: () => {
        console.log('Setting credentials in frontend-only mode');
      },
    };
  }
  return context;
};