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

export interface ConsideredTech {
  techId: string;
  techName: string;
  accepted: boolean;
  reason: string;
}

export interface DispatchDecisionData {
  selectedTechId: string;
  selectedTechName: string;
  selectionReason: string;
  consideredTechs: ConsideredTech[];
  emergencyJobType: string;
  emergencyAddress: string;
  customerName: string;
  estimatedDriveMinutes: number;
  currentJobIdToPause?: string;
  futureTechJobIds: string[];
  safetyConcerns: string;
  issueDescription: string;
}

export interface EscalationData {
  reason: string;
  consideredTechs: { techName: string; excludedReason: string }[];
}

export interface CascadeDecision {
  jobId: string;
  jobType: string;
  customerName: string;
  customerTier: string;
  action: 'reassign' | 'reschedule';
  reassignToTechId?: string;
  reassignToTechName?: string;
  newTime?: string;
  newDay?: string;
  customerMessage: string;
  reasoning: string;
}

export interface CascadeData {
  trigger: 'dispatch' | 'tech_sick' | 'job_overrun';
  affectedTechId: string;
  affectedTechName: string;
  decisions: CascadeDecision[];
}

export interface CompleteJobData {
  techId: string;
  techName: string;
  jobId: string;
  jobType: string;
  customerName: string;
  customerFollowUpMessage: string;
}

export interface CallbackAlertData {
  customerName: string;
  recentJobDescription: string;
  currentIssue: string;
}

export interface ChatResult {
  response: string;
  emergencyAlert?: EmergencyAlertData;
  dispatchDecision?: DispatchDecisionData;
  escalateToBlake?: EscalationData;
  cascade?: CascadeData;
  completeJob?: CompleteJobData;
  callbackAlert?: CallbackAlertData;
}

// ─── Tool definitions ────────────────────────────────────────────────────────

const EMERGENCY_TOOL: Anthropic.Tool = {
  name: 'post_emergency_alert',
  description:
    'Post an EMERGENCY INCOMING alert to the ops channel when severity is Critical or Urgent. ' +
    'Call as soon as severity is determined. Check your conversation history — do NOT call this again if you already called it for this emergency. ' +
    'A second emergency from a different customer IS a new incident and should get its own alert.',
  input_schema: {
    type: 'object' as const,
    properties: {
      severity: { type: 'string', enum: ['Critical', 'Urgent'] },
      customerName: { type: 'string', description: 'Full name or "Unknown"' },
      customerTier: { type: 'string', description: 'platinum / gold / standard / NEW' },
      customerSince: { type: 'string', description: 'e.g. "March 2018", or empty if new' },
      address: { type: 'string', description: 'Service address or "Collecting..."' },
      isNewCustomer: { type: 'boolean' },
      issue: { type: 'string', description: 'One-line summary' },
      safetyConcerns: { type: 'string', description: 'electrical / gas / flooding / sewage / none' },
    },
    required: ['severity', 'issue', 'customerName', 'isNewCustomer'],
  },
};

const DISPATCH_TOOL: Anthropic.Tool = {
  name: 'dispatch_tech',
  description:
    'Dispatch a tech to the emergency once address is confirmed. Include every tech in consideredTechs. ' +
    'Check your conversation history — do NOT call this again for an emergency already dispatched. ' +
    'A second distinct emergency (different customer or address) is a new incident and should be dispatched separately. ' +
    'Call this together with handle_cascade in the same response.',
  input_schema: {
    type: 'object' as const,
    properties: {
      selectedTechId: { type: 'string' },
      selectedTechName: { type: 'string' },
      selectionReason: { type: 'string' },
      consideredTechs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            techId: { type: 'string' },
            techName: { type: 'string' },
            accepted: { type: 'boolean' },
            reason: { type: 'string' },
          },
          required: ['techId', 'techName', 'accepted', 'reason'],
        },
      },
      emergencyJobType: { type: 'string' },
      emergencyAddress: { type: 'string' },
      customerName: { type: 'string' },
      estimatedDriveMinutes: { type: 'number' },
      currentJobIdToPause: { type: 'string' },
      futureTechJobIds: { type: 'array', items: { type: 'string' } },
      safetyConcerns: { type: 'string' },
      issueDescription: { type: 'string' },
    },
    required: [
      'selectedTechId', 'selectedTechName', 'selectionReason', 'consideredTechs',
      'emergencyAddress', 'customerName', 'estimatedDriveMinutes', 'issueDescription',
    ],
  },
};

const ESCALATE_TOOL: Anthropic.Tool = {
  name: 'escalate_to_blake',
  description: 'Escalate to Blake when no tech can be safely dispatched.',
  input_schema: {
    type: 'object' as const,
    properties: {
      reason: { type: 'string' },
      consideredTechs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            techName: { type: 'string' },
            excludedReason: { type: 'string' },
          },
          required: ['techName', 'excludedReason'],
        },
      },
    },
    required: ['reason', 'consideredTechs'],
  },
};

const CASCADE_TOOL: Anthropic.Tool = {
  name: 'handle_cascade',
  description:
    'Handle displaced jobs after emergency dispatch, a tech calling in sick, or a job running long. ' +
    'For each displaced job, decide: reassign to another available tech today (skill-matched, slot available) ' +
    'or reschedule to next available day. Apply tier-based treatment: ' +
    'platinum/gold get personal apology + priority rebook same-day if possible; ' +
    'standard/new get professional brief notice.',
  input_schema: {
    type: 'object' as const,
    properties: {
      trigger: { type: 'string', enum: ['dispatch', 'tech_sick', 'job_overrun'] },
      affectedTechId: { type: 'string' },
      affectedTechName: { type: 'string' },
      decisions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            jobId: { type: 'string' },
            jobType: { type: 'string' },
            customerName: { type: 'string' },
            customerTier: { type: 'string' },
            action: { type: 'string', enum: ['reassign', 'reschedule'] },
            reassignToTechId: { type: 'string' },
            reassignToTechName: { type: 'string' },
            newTime: { type: 'string', description: 'e.g. "14:00"' },
            newDay: { type: 'string', description: 'e.g. "tomorrow", "Wednesday" — for reschedule only' },
            customerMessage: { type: 'string', description: 'Notification message tailored to tier' },
            reasoning: { type: 'string' },
          },
          required: ['jobId', 'jobType', 'customerName', 'customerTier', 'action', 'customerMessage', 'reasoning'],
        },
      },
    },
    required: ['trigger', 'affectedTechId', 'affectedTechName', 'decisions'],
  },
};

const COMPLETE_JOB_TOOL: Anthropic.Tool = {
  name: 'complete_job',
  description: 'Mark a job complete when a tech reports it done. Updates schedule, makes tech available, triggers customer follow-up.',
  input_schema: {
    type: 'object' as const,
    properties: {
      techId: { type: 'string' },
      techName: { type: 'string' },
      jobId: { type: 'string', description: 'The completed job ID — read it from the bracket in the schedule: [job-001]' },
      jobType: { type: 'string' },
      customerName: { type: 'string' },
      customerFollowUpMessage: { type: 'string', description: 'Follow-up to send to customer — ask how it went, invite feedback' },
    },
    required: ['techId', 'techName', 'jobId', 'jobType', 'customerName', 'customerFollowUpMessage'],
  },
};

const CALLBACK_TOOL: Anthropic.Tool = {
  name: 'flag_callback_alert',
  description:
    'Flag a possible warranty callback when a customer mentions a recent Shamrock job may have caused or relates to the current issue. ' +
    'Per Intent #6: own it fast, offer to fix at no charge.',
  input_schema: {
    type: 'object' as const,
    properties: {
      customerName: { type: 'string' },
      recentJobDescription: { type: 'string', description: 'What Shamrock recently did' },
      currentIssue: { type: 'string', description: 'What the customer is now reporting' },
    },
    required: ['customerName', 'recentJobDescription', 'currentIssue'],
  },
};

const ALL_TOOLS = [
  EMERGENCY_TOOL,
  DISPATCH_TOOL,
  ESCALATE_TOOL,
  CASCADE_TOOL,
  COMPLETE_JOB_TOOL,
  CALLBACK_TOOL,
];

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private client: Anthropic;
  private conversationHistory: Map<string, Message[]> = new Map();
  private alertFired: Set<string> = new Set();
  private dispatchFired: Set<string> = new Set();

  constructor(private systemPromptBuilder: SystemPromptBuilder) {
    this.client = new Anthropic();
  }

  async chat(channelId: string, channel: 'customer' | 'ops' | 'tech', userMessage: string): Promise<ChatResult> {
    const systemPrompt = await this.systemPromptBuilder.build(channel);

    if (!this.conversationHistory.has(channelId)) {
      this.conversationHistory.set(channelId, []);
    }
    const history = this.conversationHistory.get(channelId);
    history.push({ role: 'user', content: userMessage });

    const recentHistory = history.slice(-20);

    // Tech channel only gets operational tools — no emergency intake
    const tools = channel === 'tech'
      ? [CASCADE_TOOL, COMPLETE_JOB_TOOL, CALLBACK_TOOL]
      : ALL_TOOLS;

    try {
      const firstResponse = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: recentHistory.map(m => ({ role: m.role, content: m.content })),
        tools,
      });

      let emergencyAlert: EmergencyAlertData | undefined;
      let dispatchDecision: DispatchDecisionData | undefined;
      let escalateToBlake: EscalationData | undefined;
      let cascade: CascadeData | undefined;
      let completeJob: CompleteJobData | undefined;
      let callbackAlert: CallbackAlertData | undefined;
      let finalResponse: string;

      if (firstResponse.stop_reason === 'tool_use') {
        const toolBlocks = firstResponse.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[];
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of toolBlocks) {
          switch (block.name) {
            case 'post_emergency_alert':
              if (!this.alertFired.has(channelId)) {
                emergencyAlert = block.input as EmergencyAlertData;
                this.alertFired.add(channelId);
              }
              toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Alert posted to ops. Now reply to the customer — continue qualifying, ask the next question.' });
              break;

            case 'dispatch_tech':
              if (!this.dispatchFired.has(channelId)) {
                dispatchDecision = block.input as DispatchDecisionData;
                this.dispatchFired.add(channelId);
              }
              toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Dispatch logged. Now reply to the customer — tell them who is coming, their first name, and the approximate ETA in minutes.' });
              break;

            case 'escalate_to_blake':
              escalateToBlake = block.input as EscalationData;
              toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Escalation sent. Now reply to the customer — tell them Blake is being contacted and they will have someone as fast as possible.' });
              break;

            case 'handle_cascade':
              cascade = block.input as CascadeData;
              toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Cascade logged. Now reply in this channel — brief confirmation appropriate to who you are talking to.' });
              break;

            case 'complete_job':
              completeJob = block.input as CompleteJobData;
              toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Job marked complete. Now reply to the tech — confirm, tell them what is next on their schedule.' });
              break;

            case 'flag_callback_alert':
              callbackAlert = block.input as CallbackAlertData;
              toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Callback flagged. Now reply to the customer — apologize, tell them we will make it right at no charge.' });
              break;

            default:
              toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Done. Now reply to the person you are talking to.' });
          }
        }

        // Second call — get the conversational reply. Instruct Claude to always produce text.
        const secondResponse = await this.client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt + '\n\nIMPORTANT: You MUST write a plain text reply right now. Do not call any tools. Write at least one sentence.',
          messages: [
            ...recentHistory.map(m => ({ role: m.role, content: m.content })),
            { role: 'assistant' as const, content: firstResponse.content },
            { role: 'user' as const, content: toolResults },
          ],
        });

        finalResponse = secondResponse.content
          .filter(b => b.type === 'text')
          .map(b => (b as Anthropic.TextBlock).text)
          .join('');

        // Safety net — if Claude still returned nothing, build a minimal response from context
        if (!finalResponse.trim()) {
          if (dispatchDecision) {
            finalResponse = `${dispatchDecision.selectedTechName.split(' ')[0]} is on the way. ETA approximately ${dispatchDecision.estimatedDriveMinutes} minutes.`;
          } else if (emergencyAlert) {
            finalResponse = 'Got it — our team is on this. Stay on the line with me.';
          } else if (escalateToBlake) {
            finalResponse = "I'm contacting our owner Blake directly to get someone to you as fast as possible.";
          } else if (completeJob) {
            finalResponse = `Got it. ${completeJob.customerName} has been followed up with.`;
          } else {
            finalResponse = 'On it.';
          }
          this.logger.warn(`Empty response from Claude after tool use — used fallback for channelId ${channelId}`);
        }
      } else {
        finalResponse = firstResponse.content
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

      return { response: finalResponse, emergencyAlert, dispatchDecision, escalateToBlake, cascade, completeJob, callbackAlert };
    } catch (error) {
      this.logger.error(`Claude API error: ${error.message}`);
      throw error;
    }
  }

  clearHistory(channelId?: string) {
    if (channelId) {
      this.conversationHistory.delete(channelId);
      this.alertFired.delete(channelId);
      this.dispatchFired.delete(channelId);
    } else {
      this.conversationHistory.clear();
      this.alertFired.clear();
      this.dispatchFired.clear();
    }
  }
}
