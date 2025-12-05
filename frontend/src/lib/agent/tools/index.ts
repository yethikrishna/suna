/**
 * y0 Agent Tools - Complete Tool Registry
 * Central export point for all agent tools using Blink SDK
 */

// Search and scraping tools
export {
  webSearchTool,
  WebSearchTool,
  type SearchResult,
  type ScrapeResult,
  type WebSearchResponse,
  webSearchToolSchema,
  scrapeToolSchema,
  screenshotToolSchema
} from './search'

// API Data Providers
export {
  // LinkedIn
  linkedInProvider,
  LinkedInHelper,
  linkedInHelper,
  LinkedInProvider,
  linkedInToolSchemas,
  type LinkedInProvider as LinkedInProviderType
} from './api-providers/linkedin'

export {
  // Twitter
  twitterProvider,
  TwitterHelper,
  twitterHelper,
  TwitterProvider,
  twitterToolSchemas,
  type TwitterProvider as TwitterProviderType
} from './api-providers/twitter'

export {
  // Amazon
  amazonProvider,
  AmazonHelper,
  amazonHelper,
  AmazonProvider,
  amazonToolSchemas,
  type AmazonProvider as AmazonProviderType
} from './api-providers/amazon'

export {
  // Yahoo Finance
  yahooFinanceProvider,
  YahooFinanceHelper,
  yahooFinanceHelper,
  YahooFinanceProvider,
  yahooFinanceToolSchemas,
  type YahooFinanceProvider as YahooFinanceProviderType
} from './api-providers/yahoo-finance'

export {
  // Zillow
  zillowProvider,
  ZillowHelper,
  zillowHelper,
  ZillowProvider,
  zillowToolSchemas,
  type ZillowProvider as ZillowProviderType
} from './api-providers/zillow'

// Base provider utilities
export {
  DataProviderBase,
  createApiProvider,
  ApiProviderError,
  RateLimitError,
  AuthenticationError,
  type EndpointSchema,
  type ApiResponse
} from './api-providers/base'

/**
 * Complete tool registry for AI agents
 */
export const agentTools = {
  // Search tools
  search: {
    tool: webSearchTool,
    schemas: {
      webSearchToolSchema,
      scrapeToolSchema,
      screenshotToolSchema
    }
  },

  // Data providers
  dataProviders: {
    linkedin: {
      provider: linkedInProvider,
      helper: linkedInHelper,
      schemas: linkedInToolSchemas
    },
    twitter: {
      provider: twitterProvider,
      helper: twitterHelper,
      schemas: twitterToolSchemas
    },
    amazon: {
      provider: amazonProvider,
      helper: amazonHelper,
      schemas: amazonToolSchemas
    },
    yahooFinance: {
      provider: yahooFinanceProvider,
      helper: yahooFinanceHelper,
      schemas: yahooFinanceToolSchemas
    },
    zillow: {
      provider: zillowProvider,
      helper: zillowHelper,
      schemas: zillowToolSchemas
    }
  }
}

/**
 * Get all available tool schemas for AI agents
 */
export function getAllToolSchemas() {
  const schemas: Record<string, any> = {}

  // Add search tool schemas
  Object.assign(schemas, agentTools.search.schemas)

  // Add data provider schemas
  Object.values(agentTools.dataProviders).forEach(provider => {
    Object.assign(schemas, provider.schemas)
  })

  return schemas
}

/**
 * Get tool by name
 */
export function getTool(name: string) {
  if (name === 'search' || name.startsWith('web_search') || name.startsWith('scrape')) {
    return agentTools.search.tool
  }

  // Check data providers
  const [providerType] = Object.keys(agentTools.dataProviders).filter(key =>
    name.includes(key) || name.startsWith(key)
  )

  if (providerType && agentTools.dataProviders[providerType as keyof typeof agentTools.dataProviders]) {
    return agentTools.dataProviders[providerType as keyof typeof agentTools.dataProviders]
  }

  return null
}

/**
 * Execute tool by name with parameters
 */
export async function executeTool(name: string, parameters: Record<string, any>) {
  try {
    // Search tools
    if (name === 'web_search') {
      return await webSearchTool.search(parameters.query, {
        limit: parameters.limit,
        type: parameters.type,
        location: parameters.location
      })
    }

    if (name === 'scrape_webpage') {
      return await webSearchTool.scrape(Array.isArray(parameters.urls) ? parameters.urls : [parameters.urls])
    }

    if (name === 'take_screenshot') {
      return await webSearchTool.screenshot(Array.isArray(parameters.urls) ? parameters.urls : [parameters.urls], {
        fullPage: parameters.fullPage,
        width: parameters.width,
        height: parameters.height
      })
    }

    // LinkedIn tools
    if (name.startsWith('linkedin') || name.startsWith('get_linkedin') || name.startsWith('search_linkedin')) {
      if (name.includes('profile') || name.includes('person')) {
        return await linkedInHelper.getPersonProfile(parameters.profileUrl || parameters.username || parameters.query)
      }
      if (name.includes('search')) {
        return await linkedInHelper.searchPeople(parameters.query, parameters)
      }
      if (name.includes('company')) {
        return await linkedInHelper.getCompanyProfile(parameters.companyUrl)
      }
      if (name.includes('jobs')) {
        return await linkedInHelper.searchJobs(parameters.query, parameters)
      }
    }

    // Twitter tools
    if (name.startsWith('twitter') || name.startsWith('get_twitter')) {
      if (name.includes('profile') || name.includes('user')) {
        return await twitterHelper.getUserProfile(parameters.username)
      }
      if (name.includes('search')) {
        return await twitterHelper.searchTweets(parameters.query, parameters.limit)
      }
      if (name.includes('tweets')) {
        return await twitterHelper.getUserTweets(parameters.username, parameters.limit)
      }
      if (name.includes('tweet')) {
        return await twitterHelper.getTweetDetails(parameters.tweetId)
      }
    }

    // Amazon tools
    if (name.startsWith('amazon') || name.startsWith('get_amazon')) {
      if (name.includes('product') || name.includes('details')) {
        return await amazonHelper.getProductDetails(parameters.asin)
      }
      if (name.includes('search')) {
        return await amazonHelper.searchProducts(parameters.keyword, parameters)
      }
      if (name.includes('reviews')) {
        return await amazonHelper.getProductReviews(parameters.asin, parameters.page)
      }
      if (name.includes('price')) {
        return await amazonHelper.getPriceHistory(parameters.asin, parameters.days)
      }
      if (name.includes('best') || name.includes('sellers')) {
        return await amazonHelper.getBestSellers(parameters.category)
      }
    }

    // Yahoo Finance tools
    if (name.startsWith('yahoo') || name.startsWith('get_yahoo_finance')) {
      if (name.includes('price') || name.includes('stock')) {
        return await yahooFinanceHelper.getStockPrice(parameters.symbol)
      }
      if (name.includes('details')) {
        return await yahooFinanceHelper.getStockDetails(parameters.symbol)
      }
      if (name.includes('historical')) {
        return await yahooFinanceHelper.getHistoricalData(parameters.symbol, parameters)
      }
      if (name.includes('market') || name.includes('movers')) {
        return await yahooFinanceHelper.getMarketMovers(parameters.market)
      }
    }

    // Zillow tools
    if (name.startsWith('zillow') || name.startsWith('get_zillow')) {
      if (name.includes('property') || name.includes('details')) {
        return await zillowHelper.getPropertyDetails(parameters.zpid)
      }
      if (name.includes('search')) {
        return await zillowHelper.searchProperties(parameters.location, parameters)
      }
      if (name.includes('estimate')) {
        return await zillowHelper.getPropertyEstimate(parameters.address)
      }
      if (name.includes('market')) {
        return await zillowHelper.getMarketData(parameters.location)
      }
      if (name.includes('mortgage')) {
        return zillowHelper.calculateMortgage(parameters.principal, parameters)
      }
    }

    throw new Error(`Tool '${name}' not found or not implemented`)

  } catch (error) {
    console.error(`Error executing tool '${name}':`, error)
    throw new Error(`Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Default export with all tools
 */
export default agentTools