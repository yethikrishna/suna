'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { SupabaseClient } from '@supabase/supabase-js';
import { useSupabaseCredentials } from '@/contexts/SupabaseCredentialsContext';

type AuthContextType = {
  supabase: SupabaseClient | null;
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode; }) => {
  const { supabaseUrl, supabaseAnonKey } = useSupabaseCredentials();

  const supabase = createClient({ supabaseUrl, supabaseAnonKey });
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    const getInitialSession = async () => {
      if (!supabase) {
        setIsLoading(false);
        return;
      }
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);
    };

    getInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!supabase) {
          return;
        }
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (isLoading) setIsLoading(false);
      },
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };

  }, [supabase, isLoading]);

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  const value = {
    supabase,
    session,
    user,
    isLoading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
