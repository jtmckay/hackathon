import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { SystemPromptBuilder } from './system-prompt.builder';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private client: Anthropic;
  private conversationHistory: Map<string, Message[]> = new Map();

  constructor(private systemPromptBuilder: SystemPromptBuilder) {
    this.client = new Anthropic();
  }

  async chat(channelId: string, channel: 'customer' | 'ops', userMessage: string): Promise<string> {
    const systemPrompt = await this.systemPromptBuilder.build(channel);

    if (!this.conversationHistory.has(channelId)) {
      this.conversationHistory.set(channelId, []);
    }
    const history = this.conversationHistory.get(channelId);
    history.push({ role: 'user', content: userMessage });

    // Keep last 20 messages to avoid token overflow
    const recentHistory = history.slice(-20);

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: recentHistory,
      });

      const assistantMessage = response.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');

      history.push({ role: 'assistant', content: assistantMessage });

      // Trim history in place
      if (history.length > 20) {
        const trimmed = history.slice(-20);
        history.length = 0;
        history.push(...trimmed);
      }

      return assistantMessage;
    } catch (error) {
      this.logger.error(`Claude API error: ${error.message}`);
      throw error;
    }
  }

  clearHistory(channelId?: string) {
    if (channelId) {
      this.conversationHistory.delete(channelId);
    } else {
      this.conversationHistory.clear();
    }
  }
}
