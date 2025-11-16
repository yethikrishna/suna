'use server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env';

export const createClient = async ({ supabaseUrl, supabaseAnonKey }: { supabaseUrl?: string; supabaseAnonKey?: string; } = {}) => {
  const cookieStore = await cookies();
  let finalSupabaseUrl = supabaseUrl || getSupabaseUrl();
  const finalSupabaseAnonKey = supabaseAnonKey || getSupabaseAnonKey();

  // Ensure the URL is in the proper format with http/https protocol
  if (finalSupabaseUrl && !finalSupabaseUrl.startsWith('http')) {
    // If it's just a hostname without protocol, add http://
    finalSupabaseUrl = `http://${finalSupabaseUrl}`;
  }

  // console.log('[SERVER] Supabase URL:', finalSupabaseUrl);
  // console.log('[SERVER] Supabase Anon Key:', finalSupabaseAnonKey);

  if (!finalSupabaseUrl || !finalSupabaseAnonKey) {
     return null; // Return null if credentials are not available
   }

   return createServerClient(finalSupabaseUrl, finalSupabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
         try {
           cookieStore.set(name, value, options);
         } catch (error) {
           console.error('Error setting cookie:', error);
         }
       },
       remove(name: string, options: CookieOptions) {
         try {
           cookieStore.set(name, '', options);
         } catch (error) {
           console.error('Error removing cookie:', error);
         }
       },
    },
  });
};
