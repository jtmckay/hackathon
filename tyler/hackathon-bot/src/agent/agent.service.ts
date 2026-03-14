import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { SystemPromptBuilder } from './system-prompt.builder';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface EmergencyAlertData {
  severity: 'Critical' | 'Urgent';
  customerName: string;
  customerTier: string;
  customerSince: string;
  address: string;
  isNewCustomer: boolean;
  issue: string;
  safetyConcerns: string;
}

export interface ChatResult {
  response: string;
  emergencyAlert?: EmergencyAlertData;
}

const EMERGENCY_TOOL: Anthropic.Tool = {
  name: 'post_emergency_alert',
  description:
    'Post an EMERGENCY INCOMING alert to the ops channel when an emergency is classified as Critical or Urgent. ' +
    'Call this as soon as severity is determined — do NOT wait for all qualifying questions to be answered. ' +
    'Only call this once per emergency incident.',
  input_schema: {
    type: 'object' as const,
    properties: {
      severity: {
        type: 'string',
        enum: ['Critical', 'Urgent'],
        description: 'Emergency severity level',
      },
      customerName: {
        type: 'string',
        description: 'Customer full name, or "Unknown" if not yet collected',
      },
      customerTier: {
        type: 'string',
        description: 'Customer value tier from the database: platinum, gold, standard. Use "NEW" if not in database.',
      },
      customerSince: {
        type: 'string',
        description: 'Date customer joined from the database (e.g. "March 2018"), or empty string if new customer',
      },
      address: {
        type: 'string',
        description: 'Service address if known, or "Collecting..." if not yet provided',
      },
      isNewCustomer: {
        type: 'boolean',
        description: 'True if this customer is not found in the database',
      },
      issue: {
        type: 'string',
        description: 'One-line summary of the emergency (e.g. "Active flooding through ceiling, water main status unknown")',
      },
      safetyConcerns: {
        type: 'string',
        description: 'Safety hazards present: electrical, gas, flooding, sewage — or "none"',
      },
    },
    required: ['severity', 'issue', 'customerName', 'isNewCustomer'],
  },
};

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private client: Anthropic;
  private conversationHistory: Map<string, Message[]> = new Map();
  // Track which channels have already fired an alert this session
  private alertFired: Set<string> = new Set();

  constructor(private systemPromptBuilder: SystemPromptBuilder) {
    this.client = new Anthropic();
  }

  async chat(channelId: string, channel: 'customer' | 'ops', userMessage: string): Promise<ChatResult> {
    const systemPrompt = await this.systemPromptBuilder.build(channel);

    if (!this.conversationHistory.has(channelId)) {
      this.conversationHistory.set(channelId, []);
    }
    const history = this.conversationHistory.get(channelId);
    history.push({ role: 'user', content: userMessage });

    const recentHistory = history.slice(-20);

    // Only offer the emergency tool for customer-facing or unified channels, and only once per incident
    const tools: Anthropic.Tool[] = (channel !== 'ops' && !this.alertFired.has(channelId))
      ? [EMERGENCY_TOOL]
      : [];

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: recentHistory,
        ...(tools.length > 0 ? { tools } : {}),
      });

      let emergencyAlert: EmergencyAlertData | undefined;
      let finalResponse: string;

      if (response.stop_reason === 'tool_use') {
        const toolUseBlock = response.content.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock;
        emergencyAlert = toolUseBlock.input as EmergencyAlertData;
        this.alertFired.add(channelId);

        // Build messages with tool result so Claude can reply to the customer
        const messagesWithToolResult: Anthropic.MessageParam[] = [
          ...recentHistory.map(m => ({ role: m.role, content: m.content })),
          { role: 'assistant' as const, content: response.content },
          {
            role: 'user' as const,
            content: [
              {
                type: 'tool_result' as const,
                tool_use_id: toolUseBlock.id,
                content: 'Alert posted to ops channel.',
              },
            ],
          },
        ];

        // Second call to get the customer-facing response
        const response2 = await this.client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: messagesWithToolResult,
        });

        finalResponse = response2.content
          .filter(b => b.type === 'text')
          .map(b => (b as Anthropic.TextBlock).text)
          .join('');
      } else {
        finalResponse = response.content
          .filter(b => b.type === 'text')
          .map(b => (b as Anthropic.TextBlock).text)
          .join('');
      }

      history.push({ role: 'assistant', content: finalResponse });

      if (history.length > 20) {
        const trimmed = history.slice(-20);
        history.length = 0;
        history.push(...trimmed);
      }

      return { response: finalResponse, emergencyAlert };
    } catch (error) {
      this.logger.error(`Claude API error: ${error.message}`);
      throw error;
    }
  }

  clearHistory(channelId?: string) {
    if (channelId) {
      this.conversationHistory.delete(channelId);
      this.alertFired.delete(channelId);
    } else {
      this.conversationHistory.clear();
      this.alertFired.clear();
    }
  }
}
