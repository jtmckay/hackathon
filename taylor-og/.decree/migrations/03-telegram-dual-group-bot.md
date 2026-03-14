---
routine: develop
---
# 03: Telegram Dual-Group Bot

## Overview

Wire up the Telegram bot with dual-group architecture: a customer-facing group where customers report issues and receive updates, and an ops group where Blake and techs see dispatch decisions, schedule changes, and briefings. The bot routes messages to the correct group handler and posts proactively to both groups.

## Requirements

### Telegram Bot Setup (src/telegram/bot.ts)

Using the `telegraf` library, create a bot that:

1. Initializes with `TELEGRAM_BOT_TOKEN` from environment
2. Listens for messages in two groups identified by `TELEGRAM_CUSTOMER_GROUP_ID` and `TELEGRAM_OPS_GROUP_ID`
3. Routes incoming messages based on which group they arrive in:
   - Messages from the customer group → processed through the Claude client on the "customer" conversation
   - Messages from the ops group → processed through the Claude client on the "ops" conversation
4. Sends the Claude response back to the same group
5. Handles errors gracefully — if the Claude API fails, send a human-readable error message ("We're having a technical issue — please call us at [number]" for customer group, "API error: [details]" for ops group)

### Group Manager (src/telegram/groups.ts)

A module that provides methods for proactive posting to either group:

- `postToCustomer(message: string)` — sends a message to the customer group
- `postToOps(message: string)` — sends a message to the ops group
- `postToOpsFormatted(sections: OpsMessage)` — sends a structured ops message with sections (used for dispatch decisions, schedule rebuilds, Blake briefings)
- Message formatting: ops group messages use Telegram's MarkdownV2 or HTML formatting for structure (headers, code blocks, bullet points). Customer group messages are plain, warm text.

The `OpsMessage` type:
```typescript
interface OpsMessage {
  title: string;       // e.g., "EMERGENCY INCOMING", "DISPATCH DECISION", "BLAKE BRIEFING"
  body: string;        // main content
  reasoning?: string;  // decision reasoning (shown in a distinct block)
  schedule?: string;   // updated schedule view
  action?: string;     // what action was taken or is needed
}
```

### Message Handler (src/telegram/handler.ts)

The handler sits between Telegram and the Claude client:

1. Receives a Telegram message context (chat ID, message text, sender info)
2. Determines which group the message belongs to
3. Enriches the message with metadata before sending to Claude:
   - For ops group: prepend sender name if it's a tech (e.g., "Marcus says: heading there now")
   - For customer group: check if the sender matches a known customer in the database and include their profile context
4. Calls the Claude client `chat()` method with the appropriate channel and enriched message
5. Parses the Claude response for **action directives** — special markers in the response that trigger side effects:
   - `[POST_TO_OPS: ...]` — the agent wants to post something to the ops group while responding to a customer
   - `[POST_TO_CUSTOMER: ...]` — the agent wants to post something to the customer group while responding in ops
   - `[UPDATE_STATE: ...]` — the agent wants to mutate state (tech status, job status, etc.)
   - These directives are stripped from the visible response and executed as side effects
6. Sends the cleaned response back to the originating group
7. Executes any side-effect directives

### Action Directive Parser (src/agent/directives.ts)

Parses the Claude response for bracketed directives and returns:
```typescript
interface ParsedResponse {
  visibleText: string;          // the response with directives stripped
  opsMessages: string[];        // messages to post to ops group
  customerMessages: string[];   // messages to post to customer group
  stateUpdates: StateUpdate[];  // state mutations to apply
}
```

This is how the agent takes autonomous action: when a customer reports an emergency, the agent responds calmly to the customer AND simultaneously posts the alert to the ops group, all from a single Claude API call.

Include clear instructions in the system prompt (from migration 02 — update the prompt builder) that teach the agent how to use these directives:
- When to use `[POST_TO_OPS: ...]`: any time something happens in the customer group that Blake or techs should know about
- When to use `[POST_TO_CUSTOMER: ...]`: any time a decision in ops needs to reach the customer (e.g., ETA update after tech confirms)
- When to use `[UPDATE_STATE: ...]`: after dispatch decisions, schedule changes, job completions

### Startup Command (src/telegram/startup.ts)

A function that can be called on bot startup or manually (via ops group command `/morning`) to:
1. Post the day's schedule to the ops group in a clean, readable format
2. Flag any techs with fully booked days (no flex)
3. Flag if any flex buffer slots are already consumed
4. Show the customer lineup by tier

### Entry Point Update

Update `src/index.ts`:
- Default mode (no flags): start the Telegram bot
- `--repl` flag: start the CLI REPL (from migration 02)
- Both modes initialize the same state manager and Claude client

## Files to Create

- `src/telegram/bot.ts` — Telegram bot initialization and message routing
- `src/telegram/groups.ts` — group manager for proactive posting
- `src/telegram/handler.ts` — message handler (enrichment, Claude call, directive execution)
- `src/telegram/startup.ts` — morning schedule posting
- `src/agent/directives.ts` — action directive parser
- `src/agent/__tests__/directives.test.ts` — directive parser tests

## Files to Modify

- `src/index.ts` — add Telegram bot startup as default mode
- `src/prompts/system-prompt.ts` — add directive usage instructions to the static prompt section
- `package.json` — add `"start"` script: `"tsx src/index.ts"`

## Acceptance Criteria

- **Given** valid Telegram credentials in `.env`
  **When** `npm start` is executed
  **Then** the bot connects to Telegram and logs "Shamrock Plumbing bot is live"

- **Given** the bot is running
  **When** a message is sent in the customer group
  **Then** the bot responds in the customer group with a message that sounds like Shamrock Plumbing

- **Given** the bot is running
  **When** a message is sent in the ops group
  **Then** the bot responds in the ops group with operational information

- **Given** a message is sent in the customer group
  **When** the agent's response contains `[POST_TO_OPS: Emergency alert details]`
  **Then** "Emergency alert details" is posted to the ops group and the directive is not visible in the customer group response

- **Given** a message is sent in the ops group
  **When** the agent's response contains `[POST_TO_CUSTOMER: Your tech is on the way]`
  **Then** "Your tech is on the way" is posted to the customer group and the directive is not visible in the ops group response

- **Given** the directive parser receives `"I'll help you right away. [POST_TO_OPS: EMERGENCY INCOMING from customer] Let me ask some questions."`
  **When** `parseDirectives()` is called
  **Then** `visibleText` is `"I'll help you right away. Let me ask some questions."` and `opsMessages` contains `"EMERGENCY INCOMING from customer"`

- **Given** the bot is running and connected
  **When** `/morning` is sent in the ops group
  **Then** the bot posts the full Monday schedule with tech assignments, flex buffer status, and tier breakdown

- **Given** the bot receives a message from the ops group
  **When** the sender's name matches a tech name (e.g., "Marcus")
  **Then** the message is enriched with the tech's identity before being sent to Claude (e.g., "Tech Marcus says: ...")

- **Given** the Claude API returns an error
  **When** a customer sends a message
  **Then** the bot responds with a friendly fallback message, not a stack trace

- **Given** the bot is running
  **When** messages are sent rapidly to both groups
  **Then** each group's conversation history remains independent and responses are contextually appropriate to their group
