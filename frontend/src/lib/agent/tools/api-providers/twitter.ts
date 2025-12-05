/**
 * y0 Twitter Data Provider - Blink SDK Implementation
 * Replaces Python TwitterProvider with TypeScript + Blink SDK
 */

import { DataProviderBase, type EndpointSchema } from './base'

/**
 * Twitter Data Provider using Blink SDK for secure API calls
 */
export class TwitterProvider extends DataProviderBase {
  constructor() {
    const endpoints: Record<string, EndpointSchema> = {
      user_data: {
        route: '/user',
        method: 'POST',
        name: 'User Data',
        description: 'Fetches comprehensive Twitter user data including profile information, follower counts, tweet statistics, and more.',
        payload: {
          username: 'Twitter username (without @)'
        }
      },
      user_tweets: {
        route: '/user_tweets',
        method: 'POST',
        name: 'User Tweets',
        description: 'Fetches recent tweets from a specific Twitter user with engagement metrics.',
        payload: {
          username: 'Twitter username (without @)',
          limit: 'Number of tweets to fetch (optional)'
        }
      },
      tweet_details: {
        route: '/tweet_details',
        method: 'POST',
        name: 'Tweet Details',
        description: 'Fetches detailed information about a specific tweet including replies, retweets, and likes.',
        payload: {
          tweet_id: 'Twitter tweet ID'
        }
      },
      search_tweets: {
        route: '/search_tweets',
        method: 'POST',
        name: 'Search Tweets',
        description: 'Searches for tweets based on keywords, hashtags, or other search criteria.',
        payload: {
          query: 'Search query (keywords, hashtags, etc.)',
          limit: 'Number of results to fetch (optional)'
        }
      },
      trends: {
        route: '/trends',
        method: 'GET',
        name: 'Twitter Trends',
        description: 'Fetches current trending topics and hashtags from Twitter.',
        payload: {
          location: 'Location identifier for trends (optional, defaults to worldwide)'
        }
      }
    }

    const baseUrl = 'https://twitter-data-api.p.rapidapi.com'
    super(baseUrl, endpoints)
  }
}

// Export singleton instance
export const twitterProvider = new TwitterProvider()

/**
 * Helper functions for common Twitter operations
 */
export class TwitterHelper {
  private provider: TwitterProvider

  constructor() {
    this.provider = twitterProvider
  }

  /**
   * Get user profile data
   */
  async getUserProfile(username: string) {
    return await this.provider.callEndpoint('user_data', { username })
  }

  /**
   * Get user's recent tweets
   */
  async getUserTweets(username: string, limit?: number) {
    return await this.provider.callEndpoint('user_tweets', {
      username,
      ...(limit && { limit: limit.toString() })
    })
  }

  /**
   * Get detailed tweet information
   */
  async getTweetDetails(tweetId: string) {
    return await this.provider.callEndpoint('tweet_details', { tweet_id: tweetId })
  }

  /**
   * Search for tweets
   */
  async searchTweets(query: string, limit?: number) {
    return await this.provider.callEndpoint('search_tweets', {
      query,
      ...(limit && { limit: limit.toString() })
    })
  }

  /**
   * Get current trends
   */
  async getTrends(location?: string) {
    return await this.provider.callEndpoint('trends', location ? { location } : {})
  }
}

// Export helper instance
export const twitterHelper = new TwitterHelper()

/**
 * Tool schemas for AI agent integration
 */
export const twitterToolSchemas = {
  getUserProfile: {
    type: 'function',
    function: {
      name: 'get_twitter_user_profile',
      description: 'Get Twitter user profile data including follower count, tweet count, and other profile information',
      parameters: {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            description: 'Twitter username without @ symbol (e.g., elonmusk)'
          }
        },
        required: ['username']
      }
    }
  },

  searchTweets: {
    type: 'function',
    function: {
      name: 'search_twitter_tweets',
      description: 'Search for tweets based on keywords, hashtags, or other search criteria',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (keywords, hashtags, etc.)'
          },
          limit: {
            type: 'number',
            description: 'Number of results to fetch (optional)',
            default: 20
          }
        },
        required: ['query']
      }
    }
  },

  getTweetDetails: {
    type: 'function',
    function: {
      name: 'get_twitter_tweet_details',
      description: 'Get detailed information about a specific tweet including replies and engagement metrics',
      parameters: {
        type: 'object',
        properties: {
          tweetId: {
            type: 'string',
            description: 'Twitter tweet ID'
          }
        },
        required: ['tweetId']
      }
    }
  },

  getUserTweets: {
    type: 'function',
    function: {
      name: 'get_twitter_user_tweets',
      description: 'Get recent tweets from a specific Twitter user',
      parameters: {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            description: 'Twitter username without @ symbol'
          },
          limit: {
            type: 'number',
            description: 'Number of tweets to fetch (optional)',
            default: 20
          }
        },
        required: ['username']
      }
    }
  }
}