import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "../prompts/system-prompt.js";
import {
  addMessage,
  getHistory,
  type Channel,
} from "./conversation.js";
import { resolveAccount } from "./account-resolver.js";
import { buildRelationshipSummary } from "./relationship-summary.js";
import { appendServiceEvent } from "../state/state.js";
import type { ServiceEvent } from "../types.js";

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 2048;

let client: Anthropic;

export function initClaudeClient(): void {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set in environment");
  }
  client = new Anthropic({ apiKey });
}

export interface ChatMetadata {
  /** e.g. "this message is from tech Marcus" */
  senderContext?: string;
  /** e.g. "this is a judge interacting live" */
  note?: string;
  /** Direct customer ID if known (e.g., from Telegram group mapping) */
  customerId?: string;
}

/**
 * Send a message to the agent on the given channel.
 * Resolves customer account, injects relationship context,
 * assembles a fresh system prompt, and logs service events.
 */
export async function chat(
  channel: Channel,
  userMessage: string,
  metadata?: ChatMetadata,
): Promise<string> {
  if (!client) {
    throw new Error("Claude client not initialized. Call initClaudeClient() first.");
  }

  // Build the user content, prepending metadata context if provided
  let content = userMessage;
  if (metadata?.senderContext) {
    content = `[${metadata.senderContext}] ${content}`;
  }
  if (metadata?.note) {
    content = `[Note: ${metadata.note}] ${content}`;
  }

  // Record the user message in history
  addMessage(channel, "user", content);

  // Resolve customer account and build relationship context
  const { customer, isNew } = resolveAccount(userMessage, channel, metadata);
  const relationshipSummary = buildRelationshipSummary(customer);

  // Log the inbound communication as a service event
  const inboundEvent: ServiceEvent = {
    id: `ev-${Date.now()}-in`,
    timestamp: new Date().toISOString(),
    type: isNew ? "intake" : "communication",
    channel: channel === "customer" ? "customer" : "ops",
    summary: `Inbound message on ${channel} channel: "${userMessage.slice(0, 100)}${userMessage.length > 100 ? "..." : ""}"`,
    sentiment: "neutral",
  };
  try {
    appendServiceEvent(customer.id, inboundEvent);
  } catch {
    // Provisional accounts may have race conditions — ignore
  }

  // Assemble fresh system prompt with current operational state + relationship context
  const systemPrompt = buildSystemPrompt(relationshipSummary, channel);

  // Get conversation history for this channel
  const messages = getHistory(channel).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages,
  });

  // Extract text from response
  const assistantText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  // Record the assistant's response in history
  addMessage(channel, "assistant", assistantText);

  // Log the outbound response as a service event
  const outboundEvent: ServiceEvent = {
    id: `ev-${Date.now()}-out`,
    timestamp: new Date().toISOString(),
    type: "communication",
    channel: channel === "customer" ? "customer" : "ops",
    summary: `Agent response on ${channel} channel: "${assistantText.slice(0, 100)}${assistantText.length > 100 ? "..." : ""}"`,
    agentReasoning: isNew
      ? "New customer — treating as first impression / audition"
      : `Known customer (${customer.name}, Tier ${customer.tier}) — full relationship context loaded`,
    sentiment: "neutral",
  };
  try {
    appendServiceEvent(customer.id, outboundEvent);
  } catch {
    // Ignore if customer was removed during processing
  }

  return assistantText;
}
