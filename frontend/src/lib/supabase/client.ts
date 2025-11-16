import { createBrowserClient } from '@supabase/ssr';
import { getCookie, setCookie, deleteCookie } from 'cookies-next';
import { type CookieSerializeOptions } from 'cookie';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env';

export const createClient = ({ supabaseUrl, supabaseAnonKey }: {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
} = {}) => {
  // Get URL and key from environment variables
  let finalSupabaseUrl = supabaseUrl || getSupabaseUrl();
  const finalSupabaseAnonKey = supabaseAnonKey || getSupabaseAnonKey();

  // Ensure the URL is in the proper format with http/https protocol
  if (finalSupabaseUrl && !finalSupabaseUrl.startsWith('http')) {
    // If it's just a hostname without protocol, add http://
    finalSupabaseUrl = `http://${finalSupabaseUrl}`;
  }

  // console.log('Supabase URL:', finalSupabaseUrl);
  // console.log('Supabase Anon Key:', finalSupabaseAnonKey);

  if (!finalSupabaseUrl || !finalSupabaseAnonKey) {
    return null; // Return null if credentials are not available
  }

  return createBrowserClient(finalSupabaseUrl, finalSupabaseAnonKey, {
    cookies: {
      get(name: string) {
        return getCookie(name);
      },
      set(name: string, value: string, options: CookieSerializeOptions) {
        setCookie(name, value, options);
      },
      remove(name: string, options: CookieSerializeOptions) {
        deleteCookie(name, options);
      },
    }
  });
};
