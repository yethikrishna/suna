/**
 * Pagination utilities following best practices from Ignacio Chiazzo's guide
 * Implements Page-based, KeySet-based, and Cursor-based pagination strategies
 */

import { 
  PaginationParams, 
  PageBasedPagination, 
  KeySetPagination, 
  CursorPagination, 
  PaginationMeta, 
  PaginatedResponse, 
  Cursor, 
  PaginationStrategy, 
  PaginationConfig 
} from './types';

/**
 * Default pagination configuration
 */
export const DEFAULT_PAGINATION_CONFIG: PaginationConfig = {
  defaultLimit: 20,
  maxLimit: 100,
  strategy: 'cursor',
  defaultOrderBy: 'createdAt',
  defaultOrderDirection: 'desc'
};

/**
 * Validates and normalizes pagination parameters
 */
export function normalizePaginationParams(
  params: Record<string, any>,
  config: PaginationConfig = DEFAULT_PAGINATION_CONFIG
): { limit: number; offset?: number; page?: number; cursor?: string; sinceId?: string } {
  const limit = Math.min(
    Math.max(1, parseInt(params.limit as string) || config.defaultLimit),
    config.maxLimit
  );

  const result: any = { limit };

  switch (config.strategy) {
    case 'page':
      result.page = Math.max(1, parseInt(params.page as string) || 1);
      result.offset = (result.page - 1) * limit;
      break;

    case 'keyset':
      if (params.sinceId) result.sinceId = params.sinceId as string;
      if (params.sinceCreatedAt) result.sinceCreatedAt = params.sinceCreatedAt as string;
      if (params.sinceUpdatedAt) result.sinceUpdatedAt = params.sinceUpdatedAt as string;
      break;

    case 'cursor':
      if (params.cursor) result.cursor = params.cursor as string;
      if (params.before) result.before = params.before as string;
      if (params.after) result.after = params.after as string;
      break;
  }

  return result;
}

/**
 * Creates pagination metadata for the response
 */
export function createPaginationMeta<T extends { id: string; createdAt: string }>(
  data: T[],
  totalCount: number,
  params: { limit: number; page?: number; cursor?: string },
  config: PaginationConfig = DEFAULT_PAGINATION_CONFIG
): PaginationMeta {
  const { limit, page, cursor } = params;
  const hasNext = data.length === limit;
  const hasPrevious = page ? page > 1 : !!cursor;

  const meta: PaginationMeta = {
    total: totalCount,
    limit,
    hasNext,
    hasPrevious
  };

  if (page) {
    meta.page = page;
  }

  if (data.length > 0) {
    meta.firstCursor = data[0].id;
    meta.lastCursor = data[data.length - 1].id;
  }

  return meta;
}

/**
 * Creates a paginated response wrapper
 */
export function createPaginatedResponse<T>(
  data: T[],
  meta: PaginationMeta
): PaginatedResponse<T> {
  return {
    data,
    meta
  };
}

/**
 * Generates cursor for pagination (Base64 encoded)
 */
export function encodeCursor(data: Cursor): string {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

/**
 * Decodes cursor from pagination
 */
export function decodeCursor(cursor: string): Cursor | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString());
  } catch {
    return null;
  }
}

/**
 * Applies pagination to a database query (example for Supabase)
 */
export function applyPaginationToQuery(
  query: any,
  params: { limit: number; offset?: number; sinceId?: string; cursor?: string; sinceCreatedAt?: string },
  config: PaginationConfig = DEFAULT_PAGINATION_CONFIG
): any {
  let resultQuery = query;

  // Apply limit
  resultQuery = resultQuery.limit(params.limit + 1); // +1 to check if there's next page

  switch (config.strategy) {
    case 'page':
      if (params.offset) {
        resultQuery = resultQuery.range(params.offset, params.offset + params.limit - 1);
      }
      break;

    case 'keyset':
      if (params.sinceId) {
        resultQuery = resultQuery.gt('id', params.sinceId);
      }
      if (params.sinceCreatedAt) {
        resultQuery = resultQuery.gt('created_at', params.sinceCreatedAt);
      }
      if (params.sinceUpdatedAt) {
        resultQuery = resultQuery.gt('updated_at', params.sinceUpdatedAt);
      }
      break;

    case 'cursor':
      if (params.cursor) {
        const cursorData = decodeCursor(params.cursor);
        if (cursorData) {
          resultQuery = resultQuery.gt('id', cursorData.id);
        }
      }
      break;
  }

  // Apply default ordering
  const orderBy = config.defaultOrderBy || 'createdAt';
  const orderDirection = config.defaultOrderDirection || 'desc';
  resultQuery = resultQuery.order(orderBy, { ascending: orderDirection === 'asc' });

  return resultQuery;
}

/**
 * Example implementation for different pagination strategies
 */

// Page-based pagination (Offset-based) - Simple but less performant for large datasets
export function createPageBasedPaginator() {
  return {
    strategy: 'page' as PaginationStrategy,
    
    paginate: (items: any[], page: number, limit: number) => {
      const offset = (page - 1) * limit;
      const paginatedItems = items.slice(offset, offset + limit);
      
      return createPaginatedResponse(paginatedItems, {
        page,
        limit,
        hasNext: offset + limit < items.length,
        hasPrevious: page > 1,
        total: items.length
      });
    }
  };
}

// KeySet-based pagination (Seek method) - More performant, uses WHERE conditions
export function createKeySetBasedPaginator() {
  return {
    strategy: 'keyset' as PaginationStrategy,
    
    paginate: (items: any[], sinceId: string, limit: number, orderBy: string = 'id') => {
      const startIndex = sinceId ? items.findIndex(item => item[orderBy] === sinceId) + 1 : 0;
      const paginatedItems = items.slice(startIndex, startIndex + limit);
      
      return createPaginatedResponse(paginatedItems, {
        limit,
        hasNext: startIndex + limit < items.length,
        hasPrevious: startIndex > 0,
        total: items.length,
        nextCursor: paginatedItems.length > 0 ? paginatedItems[paginatedItems.length - 1][orderBy] : undefined
      });
    }
  };
}

// Cursor-based pagination (Most efficient) - Uses opaque cursors
export function createCursorBasedPaginator() {
  return {
    strategy: 'cursor' as PaginationStrategy,
    
    paginate: (items: any[], cursor: string, limit: number) => {
      const cursorData = cursor ? decodeCursor(cursor) : null;
      const startIndex = cursorData ? items.findIndex(item => item.id === cursorData.id) + 1 : 0;
      const paginatedItems = items.slice(startIndex, startIndex + limit);
      
      const nextCursor = paginatedItems.length > 0 
        ? encodeCursor({ id: paginatedItems[paginatedItems.length - 1].id, createdAt: paginatedItems[paginatedItems.length - 1].createdAt })
        : undefined;
      
      return createPaginatedResponse(paginatedItems, {
        limit,
        hasNext: startIndex + limit < items.length,
        hasPrevious: cursorData !== null,
        nextCursor,
        previousCursor: cursorData ? encodeCursor(cursorData) : undefined
      });
    }
  };
}