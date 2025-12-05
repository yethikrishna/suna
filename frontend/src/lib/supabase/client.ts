/**
 * y0 Platform - Blink SDK Client
 * Primary database and auth client using Blink SDK
 */
import { blink } from '@/lib/blink/client'

export interface Database {
  public: {
    Tables: {
      users: any;
      projects: any;
      threads: any;
      messages: any;
      agent_runs: any;
      agents: any;
      workflows: any;
      mcp_servers: any;
      datasets: any;
      triggers: any;
    };
  };
}

// y0 Blink SDK Client - fully integrated with Blink
class Y0BlinkClient {
  auth: {
    signInWithPassword: (params: { email: string; password: string }) => Promise<{ data: { user: any; session: any }; error: any }>;
    signUp: (params: { email: string; password: string; [key: string]: any }) => Promise<{ data: { user: any; session: any }; error: any }>;
    signOut: () => Promise<{ error: any }>;
    getSession: () => Promise<{ data: { session: any }; error: any }>;
    getUser: () => Promise<{ data: { user: any }; error: any }>;
    me: () => Promise<any>;
    onAuthStateChange: (callback: (event: string, session: any) => void) => { data: { subscription: { unsubscribe: () => void } } };
    signInWithGoogle: () => Promise<any>;
    signInWithGitHub: () => Promise<any>;
    signInWithApple: () => Promise<any>;
    signInWithMicrosoft: () => Promise<any>;
    sendPasswordResetEmail: (email: string, options?: any) => Promise<any>;
    confirmPasswordReset: (token: string, newPassword: string) => Promise<any>;
    sendEmailVerification: () => Promise<any>;
  };

  from: (table: string) => any;

  storage: {
    from: (bucket: string) => {
      upload: (path: string, file: any, options?: any) => Promise<{ data: { path: string } | null; error: any }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
      remove: (paths: string[]) => Promise<{ error: any }>;
    };
  };

  constructor() {
    // Auth methods using Blink SDK
    this.auth = {
      signInWithPassword: async (params) => {
        try {
          const user = await blink.auth.signInWithEmail(params.email, params.password);
          return {
            data: { user, session: { user, access_token: 'mock_token' } },
            error: null
          };
        } catch (error) {
          return {
            data: { user: null, session: null },
            error
          };
        }
      },

      signUp: async (params) => {
        try {
          const user = await blink.auth.signUp(params);
          return {
            data: { user, session: { user, access_token: 'mock_token' } },
            error: null
          };
        } catch (error) {
          return {
            data: { user: null, session: null },
            error
          };
        }
      },

      signOut: async () => {
        try {
          await blink.auth.signOut();
          return { error: null };
        } catch (error) {
          return { error };
        }
      },

      getSession: async () => {
        try {
          const user = await blink.auth.me();
          return {
            data: { session: { user, access_token: 'mock_token' } },
            error: null
          };
        } catch (error) {
          return { data: { session: null }, error };
        }
      },

      getUser: async () => {
        try {
          const user = await blink.auth.me();
          return { data: { user }, error: null };
        } catch (error) {
          return { data: { user: null }, error };
        }
      },

      me: async () => {
        return await blink.auth.me();
      },

      onAuthStateChange: (callback) => {
        const unsubscribe = blink.auth.onAuthStateChanged((state) => {
          callback('SIGNED_IN' || 'SIGNED_OUT', state.user);
        });
        return { data: { subscription: { unsubscribe } } };
      },

      signInWithGoogle: async () => {
        return await blink.auth.signInWithGoogle();
      },

      signInWithGitHub: async () => {
        return await blink.auth.signInWithGitHub();
      },

      signInWithApple: async () => {
        return await blink.auth.signInWithApple();
      },

      signInWithMicrosoft: async () => {
        return await blink.auth.signInWithMicrosoft();
      },

      sendPasswordResetEmail: async (email: string, options?: any) => {
        return await blink.auth.sendPasswordResetEmail(email, options);
      },

      confirmPasswordReset: async (token: string, newPassword: string) => {
        return await blink.auth.confirmPasswordReset(token, newPassword);
      },

      sendEmailVerification: async () => {
        return await blink.auth.sendEmailVerification();
      }
    };
  }
  
  from(table: string) {
    const queryBuilder: any = {
      _table: table,
      _filters: {} as Record<string, any>,
      _columns: '*',
      _limit: undefined as number | undefined,
      _order: undefined as { column: string; ascending: boolean } | undefined,
      _single: false as boolean,

      select(columns = '*') {
        this._columns = columns;
        return this;
      },

      eq(column: string, value: any) {
        this._filters[column] = value;
        return this;
      },

      neq(column: string, value: any) {
        this._filters[`${column}__ne`] = value;
        return this;
      },

      gt(column: string, value: any) {
        this._filters[`${column}__gt`] = value;
        return this;
      },

      lt(column: string, value: any) {
        this._filters[`${column}__lt`] = value;
        return this;
      },

      gte(column: string, value: any) {
        this._filters[`${column}__gte`] = value;
        return this;
      },

      lte(column: string, value: any) {
        this._filters[`${column}__lte`] = value;
        return this;
      },

      like(column: string, pattern: any) {
        this._filters[`${column}__like`] = pattern;
        return this;
      },

      in(column: string, values: any[]) {
        this._filters[`${column}__in`] = values;
        return this;
      },

      is(column: string, value: any) {
        this._filters[column] = value;
        return this;
      },

      order(column: string, options?: { ascending?: boolean }) {
        this._order = { column, ascending: options?.ascending ?? true };
        return this;
      },

      limit(count: number) {
        this._limit = count;
        return this;
      },

      single() {
        this._limit = 1;
        this._single = true;
        return this;
      },

      async then(resolve: any, reject: any) {
        try {
          // Convert table name to Blink SDK format (camelCase)
          const blinkTable = this._table.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());

          // Build query parameters for Blink SDK
          const queryParams: any = {};
          if (Object.keys(this._filters).length > 0) {
            queryParams.where = this._filters;
          }
          if (this._order) {
            queryParams.orderBy = {
              [this._order.column]: this._order.ascending ? 'asc' : 'desc'
            };
          }
          if (this._limit) {
            queryParams.limit = this._limit;
          }

          // Use Blink SDK database operations
          const result = await blink.db[blinkTable]?.list?.(queryParams) || [];
          let data = result;

          // Return single or array
          if (this._single) {
            resolve({ data: data[0] || null, error: null });
          } else {
            resolve({ data, error: null });
          }
        } catch (error) {
          reject({ data: null, error });
        }
      }
    };

    // Insert operation using Blink SDK
    queryBuilder.insert = async (values: any) => {
      try {
        const blinkTable = table.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
        const data = Array.isArray(values)
          ? await blink.db[blinkTable]?.createMany?.(values)
          : [await blink.db[blinkTable]?.create?.(values)];
        return { data: data || [], error: null };
      } catch (error) {
        return { data: null, error };
      }
    };

    // Update operation using Blink SDK
    queryBuilder.update = (updates: any) => {
      return {
        eq: async (column: string, value: any) => {
          try {
            const blinkTable = table.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
            const data = await blink.db[blinkTable]?.update?.(value, updates);
            return { data: data || [], error: null };
          } catch (error) {
            return { data: null, error };
          }
        },
        match: async (filters: Record<string, any>) => {
          try {
            const blinkTable = table.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
            // For match, find the record first, then update
            const records = await blink.db[blinkTable]?.list?.({ where: filters });
            if (records && records.length > 0) {
              const data = await blink.db[blinkTable]?.update?.(records[0].id, updates);
              return { data: data || [], error: null };
            }
            return { data: [], error: null };
          } catch (error) {
            return { data: null, error };
          }
        }
      };
    };

    // Delete operation using Blink SDK
    queryBuilder.delete = () => {
      return {
        eq: async (column: string, value: any) => {
          try {
            const blinkTable = table.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
            await blink.db[blinkTable]?.delete?.(value);
            return { data: null, error: null };
          } catch (error) {
            return { data: null, error };
          }
        },
        match: async (filters: Record<string, any>) => {
          try {
            const blinkTable = table.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
            // For match, find the record first, then delete
            const records = await blink.db[blinkTable]?.list?.({ where: filters });
            if (records && records.length > 0) {
              await blink.db[blinkTable]?.delete?.(records[0].id);
            }
            return { data: null, error: null };
          } catch (error) {
            return { data: null, error };
          }
        }
      };
    };

    return queryBuilder;
  }

  // Storage using Blink SDK
  storage = {
    from: (bucket: string) => {
      return {
        upload: async (path: string, file: any, options?: any) => {
          try {
            const result = await blink.storage.upload(file, path, {
              upsert: options?.upsert || false
            });
            return { data: { path: result.publicUrl }, error: null };
          } catch (error) {
            return { data: null, error };
          }
        },
        getPublicUrl: (path: string) => {
          // For Blink SDK, construct the public URL
          const publicUrl = `https://storage.blink.new/${bucket}/${path}`;
          return { data: { publicUrl } };
        },
        remove: async (paths: string[]) => {
          try {
            await blink.storage.remove(...paths);
            return { error: null };
          } catch (error) {
            return { error };
          }
        }
      };
    }
  };
}

// Create y0 Blink client instance
export function createY0Client() {
  return new Y0BlinkClient();
}

export const y0Client = createY0Client();

// Export backward compatibility alias
export const supabaseClient = y0Client;

// Export types for other modules
export { Database };
