// 前端-only 模拟的 Supabase 客户端
// 移除对真实 Supabase 后端的依赖

// 定义模拟的类型
export interface Database {
  public: {
    Tables: {
      users: any;
      projects: any;
      threads: any;
      messages: any;
      agent_runs: any;
    };
  };
}

// 模拟的 Supabase 客户端类
class MockSupabaseClient {
  auth: {
    signInWithPassword: () => Promise<{ data: { user: any; session: any } }>;
    signOut: () => Promise<void>;
    getSession: () => Promise<{ data: { session: any } }>;
    getUser: () => Promise<{ data: { user: any } }>;
    onAuthStateChange: () => () => void;
  };
  
  from: (table: string) => {
    select: (columns?: string) => {
      eq: (column: string, value: any) => Promise<{ data: any[] }>;
      limit: (count: number) => Promise<{ data: any[] }>;
    };
    insert: (data: any) => Promise<{ data: any[] }>;
    update: (updates: any) => Promise<{ data: any[] }>;
    delete: () => Promise<{ data: any[] }>;
  };
  
  storage: {
    from: (bucket: string) => {
      upload: (path: string, file: any) => Promise<{ data: { path: string } }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
      remove: (paths: string[]) => Promise<void>;
    };
  };
  
  constructor() {
    // 模拟认证功能
    this.auth = {
      signInWithPassword: async () => {
        console.log('[MOCK SUPABASE] 模拟登录');
        return {
          data: {
            user: { id: 'user_1', email: 'user@example.com' },
            session: { access_token: 'mock-access-token' }
          }
        };
      },
      signOut: async () => {
        console.log('[MOCK SUPABASE] 模拟登出');
      },
      getSession: async () => {
        console.log('[MOCK SUPABASE] 获取会话');
        return { data: { session: null } };
      },
      getUser: async () => {
        console.log('[MOCK SUPABASE] 获取用户');
        return { data: { user: null } };
      },
      onAuthStateChange: () => {
        console.log('[MOCK SUPABASE] 设置认证状态监听');
        return () => console.log('[MOCK SUPABASE] 移除认证状态监听');
      }
    };
  }
  
  // 模拟查询功能
  from(table: string) {
    console.log(`[MOCK SUPABASE] 从表 ${table} 查询`);
    return {
      select: (columns?: string) => {
        console.log(`[MOCK SUPABASE] 选择 ${columns || '*'}`);
        return {
          eq: (column: string, value: any) => {
            console.log(`[MOCK SUPABASE] 条件 ${column} = ${value}`);
            return Promise.resolve({ data: [] });
          },
          limit: (count: number) => {
            console.log(`[MOCK SUPABASE] 限制 ${count} 条`);
            return Promise.resolve({ data: [] });
          }
        };
      },
      insert: async (data: any) => {
        console.log(`[MOCK SUPABASE] 插入数据:`, data);
        return { data: [data] };
      },
      update: async (updates: any) => {
        console.log(`[MOCK SUPABASE] 更新数据:`, updates);
        return { data: [] };
      },
      delete: async () => {
        console.log(`[MOCK SUPABASE] 删除数据`);
        return { data: [] };
      }
    };
  }
  
  // 模拟存储功能
  storage = {
    from: (bucket: string) => {
      console.log(`[MOCK SUPABASE] 存储桶: ${bucket}`);
      return {
        upload: async (path: string, file: any) => {
          console.log(`[MOCK SUPABASE] 上传文件: ${path}`);
          return { data: { path } };
        },
        getPublicUrl: (path: string) => {
          console.log(`[MOCK SUPABASE] 获取公共URL: ${path}`);
          return { data: { publicUrl: `https://example.com/${path}` } };
        },
        remove: async (paths: string[]) => {
          console.log(`[MOCK SUPABASE] 删除文件:`, paths);
          return { data: [] };
        }
      };
    }
  };
}

// 创建模拟的 Supabase 客户端实例
export function createSupabaseClient() {
  console.log('[MOCK SUPABASE] 创建模拟客户端');
  return new MockSupabaseClient();
}

export const supabaseClient = createSupabaseClient();

// 导出类型供其他模块使用
export { Database };
