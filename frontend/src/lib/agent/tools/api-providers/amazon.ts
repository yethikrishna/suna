/**
 * y0 Amazon Data Provider - Blink SDK Implementation
 * Replaces Python AmazonProvider with TypeScript + Blink SDK
 */

import { DataProviderBase, type EndpointSchema } from './base'

/**
 * Amazon Data Provider using Blink SDK for secure API calls
 */
export class AmazonProvider extends DataProviderBase {
  constructor() {
    const endpoints: Record<string, EndpointSchema> = {
      product_details: {
        route: '/product',
        method: 'POST',
        name: 'Product Details',
        description: 'Fetches comprehensive Amazon product data including pricing, reviews, specifications, and availability.',
        payload: {
          asin: 'Amazon ASIN (Amazon Standard Identification Number)'
        }
      },
      product_search: {
        route: '/search',
        method: 'POST',
        name: 'Product Search',
        description: 'Searches for Amazon products based on keywords, categories, and other criteria.',
        payload: {
          keyword: 'Search keywords',
          category: 'Product category (optional)',
          page: 'Page number (optional)'
        }
      },
      product_reviews: {
        route: '/reviews',
        method: 'POST',
        name: 'Product Reviews',
        description: 'Fetches customer reviews and ratings for a specific Amazon product.',
        payload: {
          asin: 'Amazon ASIN',
          page: 'Page number of reviews (optional)'
        }
      },
      price_history: {
        route: '/price_history',
        method: 'POST',
        name: 'Price History',
        description: 'Fetches historical price data for an Amazon product.',
        payload: {
          asin: 'Amazon ASIN',
          days: 'Number of days of price history (optional)'
        }
      },
      best_sellers: {
        route: '/best_sellers',
        method: 'GET',
        name: 'Best Sellers',
        description: 'Fetches best-selling products in specific categories.',
        payload: {
          category: 'Product category (optional, defaults to all categories)'
        }
      }
    }

    const baseUrl = 'https://amazon-data-scraper.p.rapidapi.com'
    super(baseUrl, endpoints)
  }
}

// Export singleton instance
export const amazonProvider = new AmazonProvider()

/**
 * Helper functions for common Amazon operations
 */
export class AmazonHelper {
  private provider: AmazonProvider

  constructor() {
    this.provider = amazonProvider
  }

  /**
   * Get product details by ASIN
   */
  async getProductDetails(asin: string) {
    return await this.provider.callEndpoint('product_details', { asin })
  }

  /**
   * Search for products
   */
  async searchProducts(keyword: string, options: {
    category?: string
    page?: number
  } = {}) {
    const params = {
      keyword,
      ...(options.category && { category: options.category }),
      ...(options.page && { page: options.page.toString() })
    }
    return await this.provider.callEndpoint('product_search', params)
  }

  /**
   * Get product reviews
   */
  async getProductReviews(asin: string, page?: number) {
    const params = {
      asin,
      ...(page && { page: page.toString() })
    }
    return await this.provider.callEndpoint('product_reviews', params)
  }

  /**
   * Get price history
   */
  async getPriceHistory(asin: string, days?: number) {
    const params = {
      asin,
      ...(days && { days: days.toString() })
    }
    return await this.provider.callEndpoint('price_history', params)
  }

  /**
   * Get best sellers
   */
  async getBestSellers(category?: string) {
    return await this.provider.callEndpoint('best_sellers', category ? { category } : {})
  }

  /**
   * Compare multiple products
   */
  async compareProducts(asins: string[]) {
    const promises = asins.map(asin => this.getProductDetails(asin))
    const results = await Promise.allSettled(promises)

    return results.map((result, index) => ({
      asin: asins[index],
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value.data : null,
      error: result.status === 'rejected' ? result.reason : null
    }))
  }
}

// Export helper instance
export const amazonHelper = new AmazonHelper()

/**
 * Tool schemas for AI agent integration
 */
export const amazonToolSchemas = {
  getProductDetails: {
    type: 'function',
    function: {
      name: 'get_amazon_product_details',
      description: 'Get comprehensive Amazon product data including pricing, reviews, specifications, and availability',
      parameters: {
        type: 'object',
        properties: {
          asin: {
            type: 'string',
            description: 'Amazon ASIN (Amazon Standard Identification Number)'
          }
        },
        required: ['asin']
      }
    }
  },

  searchProducts: {
    type: 'function',
    function: {
      name: 'search_amazon_products',
      description: 'Search for Amazon products based on keywords, categories, and other criteria',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: 'Search keywords'
          },
          category: {
            type: 'string',
            description: 'Product category (optional)'
          },
          page: {
            type: 'number',
            description: 'Page number (optional)',
            default: 1
          }
        },
        required: ['keyword']
      }
    }
  },

  getProductReviews: {
    type: 'function',
    function: {
      name: 'get_amazon_product_reviews',
      description: 'Get customer reviews and ratings for a specific Amazon product',
      parameters: {
        type: 'object',
        properties: {
          asin: {
            type: 'string',
            description: 'Amazon ASIN'
          },
          page: {
            type: 'number',
            description: 'Page number of reviews (optional)',
            default: 1
          }
        },
        required: ['asin']
      }
    }
  },

  getPriceHistory: {
    type: 'function',
    function: {
      name: 'get_amazon_price_history',
      description: 'Get historical price data for an Amazon product',
      parameters: {
        type: 'object',
        properties: {
          asin: {
            type: 'string',
            description: 'Amazon ASIN'
          },
          days: {
            type: 'number',
            description: 'Number of days of price history (optional)',
            default: 30
          }
        },
        required: ['asin']
      }
    }
  },

  getBestSellers: {
    type: 'function',
    function: {
      name: 'get_amazon_best_sellers',
      description: 'Get best-selling Amazon products in specific categories',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Product category (optional)'
          }
        },
        required: []
      }
    }
  }
}