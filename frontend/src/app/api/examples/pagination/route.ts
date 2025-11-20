/**
 * Example API route demonstrating pagination strategies
 * Following Ignacio Chiazzo's guide on API pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  normalizePaginationParams, 
  createPaginationMeta, 
  createPaginatedResponse,
  applyPaginationToQuery,
  DEFAULT_PAGINATION_CONFIG
} from '@/lib/pagination';

// Mock data for demonstration
const mockItems = Array.from({ length: 50 }, (_, i) => ({
  id: `item-${i + 1}`,
  title: `Item ${i + 1}`,
  description: `This is item number ${i + 1}`,
  createdAt: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString(),
  updatedAt: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString()
}));

/**
 * GET handler for paginated data
 * Supports multiple pagination strategies:
 * - page-based: ?strategy=page&page=1&limit=10
 * - keyset-based: ?strategy=keyset&sinceId=item-5&limit=10
 * - cursor-based: ?strategy=cursor&cursor=eyJpZCI6Iml0ZW0tNSIsImNyZWF0ZWRBdCI6IjIwMjQtMDEtMDEifQ==&limit=10
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get pagination strategy (default: cursor)
    const strategy = (searchParams.get('strategy') as any) || 'cursor';
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '10')), 100);
    
    let result;
    
    switch (strategy) {
      case 'page':
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const offset = (page - 1) * limit;
        const pageItems = mockItems.slice(offset, offset + limit);
        
        result = {
          data: pageItems,
          meta: {
            page,
            limit,
            total: mockItems.length,
            hasNext: offset + limit < mockItems.length,
            hasPrevious: page > 1,
            firstCursor: pageItems[0]?.id,
            lastCursor: pageItems[pageItems.length - 1]?.id
          }
        };
        break;
        
      case 'keyset':
        const sinceId = searchParams.get('sinceId');
        const sinceCreatedAt = searchParams.get('sinceCreatedAt');
        
        let keysetItems = [...mockItems];
        
        if (sinceId) {
          const sinceIndex = keysetItems.findIndex(item => item.id === sinceId);
          keysetItems = keysetItems.slice(sinceIndex + 1, sinceIndex + 1 + limit);
        } else if (sinceCreatedAt) {
          keysetItems = keysetItems.filter(item => item.createdAt > sinceCreatedAt).slice(0, limit);
        } else {
          keysetItems = keysetItems.slice(0, limit);
        }
        
        result = {
          data: keysetItems,
          meta: {
            limit,
            total: mockItems.length,
            hasNext: keysetItems.length === limit,
            hasPrevious: !!sinceId || !!sinceCreatedAt,
            firstCursor: keysetItems[0]?.id,
            lastCursor: keysetItems[keysetItems.length - 1]?.id
          }
        };
        break;
        
      case 'cursor':
        const cursor = searchParams.get('cursor');
        let cursorItems = [...mockItems];
        
        if (cursor) {
          try {
            const cursorData = JSON.parse(Buffer.from(cursor, 'base64').toString());
            const cursorIndex = cursorItems.findIndex(item => item.id === cursorData.id);
            cursorItems = cursorItems.slice(cursorIndex + 1, cursorIndex + 1 + limit);
          } catch {
            // Invalid cursor, start from beginning
            cursorItems = cursorItems.slice(0, limit);
          }
        } else {
          cursorItems = cursorItems.slice(0, limit);
        }
        
        const nextCursor = cursorItems.length === limit && cursorItems.length > 0 
          ? Buffer.from(JSON.stringify({ 
              id: cursorItems[cursorItems.length - 1].id,
              createdAt: cursorItems[cursorItems.length - 1].createdAt
            })).toString('base64')
          : null;
          
        const previousCursor = cursor ? cursor : null;
        
        result = {
          data: cursorItems,
          meta: {
            limit,
            total: mockItems.length,
            hasNext: cursorItems.length === limit,
            hasPrevious: !!cursor,
            firstCursor: cursorItems[0]?.id,
            lastCursor: cursorItems[cursorItems.length - 1]?.id,
            nextCursor,
            previousCursor
          }
        };
        break;
        
      default:
        return NextResponse.json(
          { error: `Unsupported pagination strategy: ${strategy}` },
          { status: 400 }
        );
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Pagination API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST handler to create test data
 * Useful for testing pagination with different dataset sizes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { count = 10, prefix = 'test' } = body;
    
    const newItems = Array.from({ length: count }, (_, i) => ({
      id: `${prefix}-item-${Date.now()}-${i}`,
      title: `${prefix} Item ${i + 1}`,
      description: `Test item ${i + 1} created at ${new Date().toISOString()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    
    // In a real app, you would insert these into your database
    // For now, we'll just return them as a mock response
    
    return NextResponse.json({
      message: `Created ${count} test items`,
      items: newItems,
      meta: {
        count,
        prefix,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Pagination POST API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler to clear test data
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get('prefix') || 'test';
    
    // In a real app, you would delete items with this prefix from your database
    // For now, we'll just return a success message
    
    return NextResponse.json({
      message: `Cleared test data with prefix: ${prefix}`,
      meta: {
        prefix,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Pagination DELETE API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}