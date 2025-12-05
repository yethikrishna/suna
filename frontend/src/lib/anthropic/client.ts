interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence';
  stop_sequence?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

class AnthropicClient {
  private apiKey: string;
  private baseUrl = 'https://api.anthropic.com/v1';

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    if (!this.apiKey) {
      console.warn('ANTHROPIC_API_KEY not found in environment');
    }
  }

  async sendMessage(messages: AnthropicMessage[], model: string = 'claude-3-5-sonnet-20241022'): Promise<AnthropicResponse> {
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required');
    }

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4000,
          messages,
        }),
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error calling Anthropic API:', error);
      throw error;
    }
  }

  async simpleMessage(prompt: string): Promise<string> {
    const response = await this.sendMessage([
      { role: 'user', content: prompt }
    ]);

    return response.content[0]?.text || '';
  }
}

export const anthropic = new AnthropicClient();
export type { AnthropicMessage, AnthropicResponse };