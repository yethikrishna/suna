/**
 * y0 Web Search Tool - Blink SDK Implementation
 * Replaces Tavily + Firecrawl with Blink SDK search and scraping
 */

import { blink } from '@/lib/blink/client'

export interface SearchResult {
  title: string
  url: string
  snippet: string
  published_date?: string
  source?: string
}

export interface ScrapeResult {
  url: string
  title: string
  markdown: string
  metadata: {
    title?: string
    description?: string
    language?: string
    [key: string]: any
  }
  links?: Array<{
    url: string
    text: string
  }>
  success: boolean
  error?: string
}

export interface WebSearchResponse {
  query: string
  results: SearchResult[]
  answer?: string
  people_also_ask?: Array<{
    question: string
    answer: string
  }>
  related_searches?: string[]
  organic_results?: SearchResult[]
  news_results?: SearchResult[]
  image_results?: Array<{
    url: string
    title: string
    thumbnail: string
  }>
}

/**
 * Web Search using Blink SDK
 * Provides real-time search capabilities with multiple result types
 */
export class WebSearchTool {
  /**
   * Search the web for information using Blink SDK
   * @param query - Search query string
   * @param options - Search options
   * @returns Search results with structured data
   */
  async search(
    query: string,
    options: {
      limit?: number
      type?: 'news' | 'images' | 'shopping' | 'default'
      location?: string
      language?: string
    } = {}
  ): Promise<WebSearchResponse> {
    try {
      if (!query || typeof query !== 'string') {
        throw new Error('Valid search query is required')
      }

      const {
        limit = 20,
        type = 'default',
        location,
        language = 'en'
      } = options

      // Build search parameters for Blink SDK
      const searchParams: any = {
        limit: Math.min(Math.max(limit, 1), 50) // Ensure between 1-50
      }

      if (location) {
        searchParams.location = location
      }

      // Execute search using Blink SDK
      let searchResponse
      if (type === 'news') {
        searchResponse = await blink.data.search(query, {
          type: 'news',
          limit: searchParams.limit
        })
      } else if (type === 'images') {
        searchResponse = await blink.data.search(query, {
          type: 'images',
          limit: searchParams.limit
        })
      } else if (type === 'shopping') {
        searchResponse = await blink.data.search(query, {
          type: 'shopping',
          limit: searchParams.limit
        })
      } else {
        // Default search with all results
        searchResponse = await blink.data.search(query, searchParams)
      }

      // Transform Blink SDK response to match our interface
      const results: SearchResult[] = this.transformBlinkResults(searchResponse)

      const response: WebSearchResponse = {
        query,
        results,
        organic_results: results,
        related_searches: searchResponse.related_searches || [],
        people_also_ask: searchResponse.people_also_ask || []
      }

      // Add type-specific results
      if (type === 'news' && searchResponse.news_results) {
        response.news_results = searchResponse.news_results.map((item: any) => ({
          title: item.title,
          url: item.link,
          snippet: item.snippet,
          published_date: item.date,
          source: item.source
        }))
      }

      if (type === 'images' && searchResponse.image_results) {
        response.image_results = searchResponse.image_results.map((item: any) => ({
          url: item.link,
          title: item.title,
          thumbnail: item.thumbnail
        }))
      }

      return response

    } catch (error) {
      console.error('Error performing web search:', error)
      throw new Error(`Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Scrape web pages for content using Blink SDK
   * @param urls - Array of URLs to scrape
   * @returns Array of scrape results
   */
  async scrape(urls: string[]): Promise<ScrapeResult[]> {
    try {
      if (!urls || urls.length === 0) {
        throw new Error('At least one URL is required for scraping')
      }

      // Normalize URLs
      const normalizedUrls = urls.map(url => {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          return `https://${url}`
        }
        return url
      }).filter(url => url.length > 0)

      if (normalizedUrls.length === 0) {
        throw new Error('No valid URLs provided')
      }

      console.log(`Scraping ${normalizedUrls.length} URLs: ${normalizedUrls}`)

      // Scrape all URLs concurrently using Blink SDK
      const scrapePromises = normalizedUrls.map(async (url) => {
        try {
          const result = await blink.data.scrape(url)
          return {
            url,
            title: result.metadata?.title || 'Untitled',
            markdown: result.markdown || '',
            metadata: {
              title: result.metadata?.title,
              description: result.metadata?.description,
              language: result.metadata?.language,
              ...result.metadata
            },
            links: result.links || [],
            success: true
          } as ScrapeResult
        } catch (error) {
          console.error(`Error scraping URL ${url}:`, error)
          return {
            url,
            title: 'Error',
            markdown: '',
            metadata: {},
            success: false,
            error: error instanceof Error ? error.message : 'Unknown scraping error'
          } as ScrapeResult
        }
      })

      const results = await Promise.all(scrapePromises)

      // Log summary
      const successful = results.filter(r => r.success).length
      const failed = results.length - successful
      console.log(`Scraping completed: ${successful} successful, ${failed} failed`)

      return results

    } catch (error) {
      console.error('Error in scrape operation:', error)
      throw new Error(`Web scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Take screenshot of web pages using Blink SDK
   * @param urls - Array of URLs to screenshot
   * @param options - Screenshot options
   * @returns Array of screenshot URLs
   */
  async screenshot(urls: string[], options: {
    fullPage?: boolean
    width?: number
    height?: number
  } = {}): Promise<{ url: string; screenshotUrl: string; success: boolean; error?: string }[]> {
    try {
      if (!urls || urls.length === 0) {
        throw new Error('At least one URL is required for screenshots')
      }

      const { fullPage = false, width = 1920, height = 1080 } = options

      // Normalize URLs
      const normalizedUrls = urls.map(url => {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          return `https://${url}`
        }
        return url
      })

      console.log(`Taking screenshots of ${normalizedUrls.length} URLs`)

      // Take screenshots concurrently using Blink SDK
      const screenshotPromises = normalizedUrls.map(async (url) => {
        try {
          const screenshotUrl = await blink.data.screenshot(url, {
            fullPage,
            width,
            height
          })
          return {
            url,
            screenshotUrl,
            success: true
          }
        } catch (error) {
          console.error(`Error taking screenshot of ${url}:`, error)
          return {
            url,
            screenshotUrl: '',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown screenshot error'
          }
        }
      })

      return await Promise.all(screenshotPromises)

    } catch (error) {
      console.error('Error in screenshot operation:', error)
      throw new Error(`Screenshot operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Transform Blink SDK search results to our standard format
   */
  private transformBlinkResults(blinkResponse: any): SearchResult[] {
    const results: SearchResult[] = []

    // Process organic results
    if (blinkResponse.organic_results) {
      blinkResponse.organic_results.forEach((item: any) => {
        results.push({
          title: item.title || '',
          url: item.link || '',
          snippet: item.snippet || '',
          published_date: item.date,
          source: item.source
        })
      })
    }

    // Process news results
    if (blinkResponse.news_results) {
      blinkResponse.news_results.forEach((item: any) => {
        results.push({
          title: item.title || '',
          url: item.link || '',
          snippet: item.snippet || '',
          published_date: item.date,
          source: item.source
        })
      })
    }

    return results
  }
}

// Export singleton instance
export const webSearchTool = new WebSearchTool()

// Export tool schema for AI agents
export const webSearchToolSchema = {
  name: 'web_search',
  description: 'Search the web for up-to-date information using Blink SDK. This tool provides real-time search results, news articles, images, and shopping results.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to find relevant information. Be specific and include key terms for better results.'
      },
      limit: {
        type: 'number',
        description: 'Number of results to return (1-50). Default: 20',
        default: 20,
        minimum: 1,
        maximum: 50
      },
      type: {
        type: 'string',
        description: 'Type of search results to focus on',
        enum: ['default', 'news', 'images', 'shopping'],
        default: 'default'
      },
      location: {
        type: 'string',
        description: 'Location for local search results (e.g., "San Francisco,CA,United States")'
      }
    },
    required: ['query']
  }
}

export const scrapeToolSchema = {
  name: 'scrape_webpage',
  description: 'Extract full content from web pages using Blink SDK. Returns markdown content and metadata.',
  parameters: {
    type: 'object',
    properties: {
      urls: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of URLs to scrape. Multiple URLs will be processed concurrently for efficiency.'
      }
    },
    required: ['urls']
  }
}

export const screenshotToolSchema = {
  name: 'take_screenshot',
  description: 'Take screenshots of web pages using Blink SDK.',
  parameters: {
    type: 'object',
    properties: {
      urls: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of URLs to screenshot.'
      },
      fullPage: {
        type: 'boolean',
        description: 'Take full page screenshot',
        default: false
      },
      width: {
        type: 'number',
        description: 'Screenshot width in pixels',
        default: 1920
      },
      height: {
        type: 'number',
        description: 'Screenshot height in pixels',
        default: 1080
      }
    },
    required: ['urls']
  }
}