/**
 * y0 Zillow Data Provider - Blink SDK Implementation
 * Replaces Python ZillowProvider with TypeScript + Blink SDK
 */

import { DataProviderBase, type EndpointSchema } from './base'

/**
 * Zillow Data Provider using Blink SDK for secure API calls
 */
export class ZillowProvider extends DataProviderBase {
  constructor() {
    const endpoints: Record<string, EndpointSchema> = {
      property_details: {
        route: '/property',
        method: 'GET',
        name: 'Property Details',
        description: 'Fetches comprehensive property data including address, price, bedrooms, bathrooms, square footage, and more.',
        payload: {
          zpid: 'Zillow Property ID (zpid)'
        }
      },
      search_properties: {
        route: '/search',
        method: 'POST',
        name: 'Property Search',
        description: 'Searches for properties based on location, price range, and other criteria.',
        payload: {
          location: 'Search location (city, address, zip code)',
          price_min: 'Minimum price (optional)',
          price_max: 'Maximum price (optional)',
          beds_min: 'Minimum bedrooms (optional)',
          baths_min: 'Minimum bathrooms (optional)',
          sqft_min: 'Minimum square feet (optional)'
        }
      },
      property_estimate: {
        route: '/estimate',
        method: 'GET',
        name: 'Property Estimate',
        description: 'Gets Zestimate® (Zillow\'s estimated market value) for a property.',
        payload: {
          address: 'Property address'
        }
      },
      similar_properties: {
        route: '/similar',
        method: 'POST',
        name: 'Similar Properties',
        description: 'Finds similar properties for comparison based on location and characteristics.',
        payload: {
          zpid: 'Zillow Property ID',
          count: 'Number of similar properties to return (optional)'
        }
      },
      market_data: {
        route: '/market',
        method: 'GET',
        name: 'Market Data',
        description: 'Gets real estate market data for a specific area including median prices and trends.',
        payload: {
          location: 'Location for market data (city, zip code, or neighborhood)'
        }
      }
    }

    const baseUrl = 'https://zillow-api.p.rapidapi.com'
    super(baseUrl, endpoints)
  }
}

// Export singleton instance
export const zillowProvider = new ZillowProvider()

/**
 * Helper functions for common Zillow operations
 */
export class ZillowHelper {
  private provider: ZillowProvider

  constructor() {
    this.provider = zillowProvider
  }

  /**
   * Get property details by ZPID
   */
  async getPropertyDetails(zpid: string) {
    return await this.provider.callEndpoint('property_details', { zpid })
  }

  /**
   * Search for properties
   */
  async searchProperties(location: string, options: {
    priceMin?: number
    priceMax?: number
    bedsMin?: number
    bathsMin?: number
    sqftMin?: number
  } = {}) {
    const params = {
      location,
      ...(options.priceMin && { price_min: options.priceMin.toString() }),
      ...(options.priceMax && { price_max: options.priceMax.toString() }),
      ...(options.bedsMin && { beds_min: options.bedsMin.toString() }),
      ...(options.bathsMin && { baths_min: options.bathsMin.toString() }),
      ...(options.sqftMin && { sqft_min: options.sqftMin.toString() })
    }
    return await this.provider.callEndpoint('search_properties', params)
  }

  /**
   * Get property estimate (Zestimate)
   */
  async getPropertyEstimate(address: string) {
    return await this.provider.callEndpoint('property_estimate', { address })
  }

  /**
   * Get similar properties
   */
  async getSimilarProperties(zpid: string, count?: number) {
    const params = {
      zpid,
      ...(count && { count: count.toString() })
    }
    return await this.provider.callEndpoint('similar_properties', params)
  }

  /**
   * Get market data for an area
   */
  async getMarketData(location: string) {
    return await this.provider.callEndpoint('market_data', { location })
  }

  /**
   * Calculate mortgage estimate
   */
  calculateMortgage(principal: number, options: {
    downPayment?: number
    interestRate?: number
    loanTerm?: number
  } = {}) {
    const {
      downPayment = principal * 0.2, // 20% down payment
      interestRate = 0.07, // 7% annual interest
      loanTerm = 30 * 12 // 30 years in months
    } = options

    const loanAmount = principal - downPayment
    const monthlyRate = interestRate / 12

    if (monthlyRate === 0) {
      return {
        principal: loanAmount,
        monthlyPayment: loanAmount / loanTerm,
        totalPayment: loanAmount,
        totalInterest: 0
      }
    }

    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, loanTerm)) / (Math.pow(1 + monthlyRate, loanTerm) - 1)
    const totalPayment = monthlyPayment * loanTerm
    const totalInterest = totalPayment - loanAmount

    return {
      principal: loanAmount,
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      totalPayment: Math.round(totalPayment * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100
    }
  }
}

// Export helper instance
export const zillowHelper = new ZillowHelper()

/**
 * Tool schemas for AI agent integration
 */
export const zillowToolSchemas = {
  getPropertyDetails: {
    type: 'function',
    function: {
      name: 'get_zillow_property_details',
      description: 'Get comprehensive property data including address, price, bedrooms, bathrooms, and square footage',
      parameters: {
        type: 'object',
        properties: {
          zpid: {
            type: 'string',
            description: 'Zillow Property ID (zpid)'
          }
        },
        required: ['zpid']
      }
    }
  },

  searchProperties: {
    type: 'function',
    function: {
      name: 'search_zillow_properties',
      description: 'Search for properties based on location, price range, and other criteria',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'Search location (city, address, zip code)'
          },
          priceMin: {
            type: 'number',
            description: 'Minimum price (optional)'
          },
          priceMax: {
            type: 'number',
            description: 'Maximum price (optional)'
          },
          bedsMin: {
            type: 'number',
            description: 'Minimum bedrooms (optional)'
          },
          bathsMin: {
            type: 'number',
            description: 'Minimum bathrooms (optional)'
          },
          sqftMin: {
            type: 'number',
            description: 'Minimum square feet (optional)'
          }
        },
        required: ['location']
      }
    }
  },

  getPropertyEstimate: {
    type: 'function',
    function: {
      name: 'get_zillow_property_estimate',
      description: 'Get Zestimate® (Zillow\'s estimated market value) for a property',
      parameters: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'Property address'
          }
        },
        required: ['address']
      }
    }
  },

  getMarketData: {
    type: 'function',
    function: {
      name: 'get_zillow_market_data',
      description: 'Get real estate market data for a specific area including median prices and trends',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'Location for market data (city, zip code, or neighborhood)'
          }
        },
        required: ['location']
      }
    }
  },

  calculateMortgage: {
    type: 'function',
    function: {
      name: 'calculate_mortgage',
      description: 'Calculate mortgage payment estimate including principal, interest, and monthly payment',
      parameters: {
        type: 'object',
        properties: {
          principal: {
            type: 'number',
            description: 'Property price or loan amount'
          },
          downPayment: {
            type: 'number',
            description: 'Down payment amount (optional, defaults to 20% of principal)'
          },
          interestRate: {
            type: 'number',
            description: 'Annual interest rate as decimal (optional, defaults to 0.07 for 7%)'
          },
          loanTerm: {
            type: 'number',
            description: 'Loan term in years (optional, defaults to 30)'
          }
        },
        required: ['principal']
      }
    }
  }
}