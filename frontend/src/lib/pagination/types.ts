/**
 * Pagination types following the guide from Ignacio Chiazzo
 * Supports multiple pagination strategies: Page-based, KeySet-based, and Cursor-based
 */

// Base pagination parameters
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

// Page-based pagination (offset-based)
export interface PageBasedPagination extends PaginationParams {
  page?: number;
}

// KeySet-based pagination (seek method)
export interface KeySetPagination extends PaginationParams {
  sinceId?: string;
  sinceCreatedAt?: string;
  sinceUpdatedAt?: string;
  orderBy?: 'id' | 'createdAt' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
}

// Cursor-based pagination (most efficient)
export interface CursorPagination extends PaginationParams {
  cursor?: string;
  before?: string;
  after?: string;
}

// Response metadata for pagination
export interface PaginationMeta {
  total?: number;
  page?: number;
  limit: number;
  hasNext: boolean;
  hasPrevious: boolean;
  nextCursor?: string;
  previousCursor?: string;
  firstCursor?: string;
  lastCursor?: string;
}

// Paginated response wrapper
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// Cursor implementation
export interface Cursor {
  id: string;
  createdAt: string;
  [key: string]: any; // Allow additional fields
}

// Strategy types
export type PaginationStrategy = 'page' | 'keyset' | 'cursor';

// Configuration for pagination
export interface PaginationConfig {
  defaultLimit: number;
  maxLimit: number;
  strategy: PaginationStrategy;
  defaultOrderBy?: string;
  defaultOrderDirection?: 'asc' | 'desc';
}