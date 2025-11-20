// 前端-only 环境变量配置
// 提供模拟的环境变量，移除对真实后端服务的依赖

// 模拟环境变量对象
const mockEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://mock-supabase.example.com',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock-supabase-anon-key',
  NEXT_PUBLIC_API_URL: 'http://localhost:3000', // 前端自身URL
  NEXT_PUBLIC_WEB_URL: 'http://localhost:3000'
};

/**
 * 获取环境变量值，如果不存在则返回模拟值
 */
const getEnv = (key: string, defaultValue: string = ''): string => {
  console.log(`[MOCK ENV] 获取环境变量: ${key}`);
  return process.env[key] || mockEnv[key as keyof typeof mockEnv] || defaultValue;
};

/**
 * 获取Supabase URL
 */
export const getSupabaseUrl = (): string => {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  console.log('[MOCK ENV] Supabase URL:', url);
  return url;
};

/**
 * 获取Supabase Anon Key
 */
export const getSupabaseAnonKey = (): string => {
  const key = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.log('[MOCK ENV] Supabase Anon Key:', key);
  return key;
};

/**
 * 获取API URL
 */
export const getApiUrl = (): string => {
  return getEnv('NEXT_PUBLIC_API_URL');
};

/**
 * 获取Web URL
 */
export const getWebUrl = (): string => {
  return getEnv('NEXT_PUBLIC_WEB_URL');
};

/**
 * 检查是否为前端-only 模式
 */
export const isFrontendOnlyMode = (): boolean => {
  console.log('[MOCK ENV] 前端-only 模式: true');
  return true;
};