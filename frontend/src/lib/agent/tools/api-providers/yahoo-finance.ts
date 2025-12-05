/**
 * y0 Yahoo Finance Data Provider - Blink SDK Implementation
 * Replaces Python YahooFinanceProvider with TypeScript + Blink SDK
 */

import { DataProviderBase, type EndpointSchema } from './base'

/**
 * Yahoo Finance Data Provider using Blink SDK for secure API calls
 */
export class YahooFinanceProvider extends DataProviderBase {
  constructor() {
    const endpoints: Record<string, EndpointSchema> = {
      stock_price: {
        route: '/stock_price',
        method: 'GET',
        name: 'Stock Price',
        description: 'Fetches current stock price, market cap, and basic financial data.',
        payload: {
          symbol: 'Stock ticker symbol (e.g., AAPL, GOOGL)'
        }
      },
      stock_details: {
        route: '/stock_details',
        method: 'GET',
        name: 'Stock Details',
        description: 'Fetches comprehensive stock information including financial statements, statistics, and company profile.',
        payload: {
          symbol: 'Stock ticker symbol'
        }
      },
      historical_data: {
        route: '/historical_data',
        method: 'POST',
        name: 'Historical Data',
        description: 'Fetches historical price data for stocks including open, high, low, close, and volume.',
        payload: {
          symbol: 'Stock ticker symbol',
          start_date: 'Start date (YYYY-MM-DD)',
          end_date: 'End date (YYYY-MM-DD)',
          interval: 'Data interval: 1m, 5m, 15m, 30m, 1h, 1d, 1wk, 1mo'
        }
      },
      company_info: {
        route: '/company_info',
        method: 'GET',
        name: 'Company Information',
        description: 'Fetches company profile, management team, and business information.',
        payload: {
          symbol: 'Stock ticker symbol'
        }
      },
      market_movers: {
        route: '/market_movers',
        method: 'GET',
        name: 'Market Movers',
        description: 'Fetches top gaining, losing, and most active stocks for the day.',
        payload: {
          market: 'Market index: S&P500, NASDAQ, DOW (optional)'
        }
      }
    }

    const baseUrl = 'https://yahoo-finance-api.p.rapidapi.com'
    super(baseUrl, endpoints)
  }
}

// Export singleton instance
export const yahooFinanceProvider = new YahooFinanceProvider()

/**
 * Helper functions for common Yahoo Finance operations
 */
export class YahooFinanceHelper {
  private provider: YahooFinanceProvider

  constructor() {
    this.provider = yahooFinanceProvider
  }

  /**
   * Get current stock price
   */
  async getStockPrice(symbol: string) {
    return await this.provider.callEndpoint('stock_price', { symbol })
  }

  /**
   * Get detailed stock information
   */
  async getStockDetails(symbol: string) {
    return await this.provider.callEndpoint('stock_details', { symbol })
  }

  /**
   * Get historical price data
   */
  async getHistoricalData(symbol: string, options: {
    startDate?: string
    endDate?: string
    interval?: '1m' | '5m' | '15m' | '30m' | '1h' | '1d' | '1wk' | '1mo'
  } = {}) {
    const params = {
      symbol,
      start_date: options.startDate,
      end_date: options.endDate,
      interval: options.interval || '1d'
    }
    return await this.provider.callEndpoint('historical_data', params)
  }

  /**
   * Get company information
   */
  async getCompanyInfo(symbol: string) {
    return await this.provider.callEndpoint('company_info', { symbol })
  }

  /**
   * Get market movers
   */
  async getMarketMovers(market?: 'S&P500' | 'NASDAQ' | 'DOW') {
    return await this.provider.callEndpoint('market_movers', market ? { market } : {})
  }

  /**
   * Compare multiple stocks
   */
  async compareStocks(symbols: string[]) {
    const promises = symbols.map(symbol => this.getStockPrice(symbol))
    const results = await Promise.allSettled(promises)

    return results.map((result, index) => ({
      symbol: symbols[index],
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value.data : null,
      error: result.status === 'rejected' ? result.reason : null
    }))
  }
}

// Export helper instance
export const yahooFinanceHelper = new YahooFinanceHelper()

/**
 * Tool schemas for AI agent integration
 */
export const yahooFinanceToolSchemas = {
  getStockPrice: {
    type: 'function',
    function: {
      name: 'get_yahoo_finance_stock_price',
      description: 'Get current stock price, market cap, and basic financial data',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Stock ticker symbol (e.g., AAPL, GOOGL, MSFT)'
          }
        },
        required: ['symbol']
      }
    }
  },

  getStockDetails: {
    type: 'function',
    function: {
      name: 'get_yahoo_finance_stock_details',
      description: 'Get comprehensive stock information including financial statements and company profile',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Stock ticker symbol'
          }
        },
        required: ['symbol']
      }
    }
  },

  getHistoricalData: {
    type: 'function',
    function: {
      name: 'get_yahoo_finance_historical_data',
      description: 'Get historical price data for stocks including open, high, low, close, and volume',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Stock ticker symbol'
          },
          startDate: {
            type: 'string',
            description: 'Start date in YYYY-MM-DD format (optional)'
          },
          endDate: {
            type: 'string',
            description: 'End date in YYYY-MM-DD format (optional)'
          },
          interval: {
            type: 'string',
            description: 'Data interval: 1m, 5m, 15m, 30m, 1h, 1d, 1wk, 1mo',
            enum: ['1m', '5m', '15m', '30m', '1h', '1d', '1wk', '1mo'],
            default: '1d'
          }
        },
        required: ['symbol']
      }
    }
  },

  getMarketMovers: {
    type: 'function',
    function: {
      name: 'get_yahoo_finance_market_movers',
      description: 'Get top gaining, losing, and most active stocks for the day',
      parameters: {
        type: 'object',
        properties: {
          market: {
            type: 'string',
            description: 'Market index: S&P500, NASDAQ, DOW (optional)',
            enum: ['S&P500', 'NASDAQ', 'DOW']
          }
        },
        required: []
      }
    }
  }
}