---
routine: develop
---
# 02: Emergency Intake and Triage — Customer-Facing Qualification Flow

## Overview

Build the emergency intake flow in the customer channel. When a customer reports an issue, the bot detects urgency from language, asks targeted qualifying questions, classifies severity (critical/urgent/routine), checks if they're a new or existing customer, provides immediate safety instructions when needed, and posts an `EMERGENCY INCOMING` alert to the ops channel with classified details.

This is the customer-facing half of the dispatch workflow — the bot must feel like a calm, competent human dispatcher, not a form or chatbot.

**Stack:** NestJS + Prisma + SQLite + `@anthropic-ai/sdk` + `nestjs-telegraf` (long polling) — all open-source.

**Telegram model:** Single unified group chat (see migration 01). All references to "ops channel" or "customer channel" below refer to the unified group. When `MULTI_CHANNEL_ENABLED=true`, these become separate channels.

## Requirements

### Urgency Detection
- Detect emergency language patterns: "flooding", "burst", "pouring", "gas smell", "sewage", "emergency", "help", "water everywhere", ALL CAPS messages, multiple exclamation marks
- Three severity levels:
  - **Critical**: Active flooding, gas smell, sewage backup, electrical risk near water
  - **Urgent**: No hot water in winter, single fixture leak (contained), slow drain backing up
  - **Routine**: Dripping faucet, running toilet, minor leak with bucket
- Bot shifts tone and pace based on severity — critical gets fast, directive responses; routine gets friendly, conversational

### Qualification Flow (for emergencies)
- Bot asks targeted questions naturally (not as a numbered form):
  1. Where is the water coming from? (ceiling, walls, floor, fixture)
  2. Can you see the source? (burst pipe, overflowing, unknown)
  3. Have you shut off the water main? (if not, give step-by-step instructions)
  4. Is there electrical near the water? (safety-critical)
  5. What's your address? (skip if existing customer with address on file)
- Questions should flow conversationally — if customer answers multiple in one message, don't re-ask
- Bot checks customer database: if phone number or name matches existing customer, pull their history and address automatically

### Safety Response (immediate, before qualification completes)
- **Electrical risk near water**: "Stop — don't touch anything near the water. If there are outlets, switches, or appliances near the leak, stay away and don't step in the water. Are you safe right now?"
- **Gas smell**: "If you smell gas, please leave the house immediately and call 911. Once you're safe outside, message me back and we'll get a tech to you right away."
- **Active flooding**: Walk customer through shutting off the water main with clear instructions

### Customer Lookup
- When customer provides name or address, search the customer database via Prisma
- If existing customer: greet by name, reference their history ("Good to hear from you again, Mrs. Garcia"), skip address question
- If new customer: collect name, address, phone — create a new customer record
- Customer value tier affects language warmth (VIP gets more personal touch)

### Ops Channel Alert
- When emergency is classified, post to ops channel via `TelegramService`:
  ```
  🚨 EMERGENCY INCOMING
  Severity: [Critical/Urgent]
  Customer: [name] ([tier] — customer since [date] / NEW)
  Address: [address]
  Issue: [one-line summary]
  Safety concerns: [electrical/gas/none]
  Status: Qualifying — awaiting dispatch decision
  ```
- Alert posts as soon as severity is determined, even before all qualifying questions are answered

### Conversation State
- Track conversation state per customer channel thread using the `Session` model in Prisma (state + JSON data columns already exist): idle → qualifying → awaiting_dispatch → dispatched → resolved
- If customer sends follow-up messages during qualifying, incorporate new info without restarting
- If customer is panicking (repeated messages, ALL CAPS), bot stays calm and acknowledges their stress

## Files to Modify (relative to `hackathon-bot/`)
- `src/agent/agent.service.ts` — Enhanced system prompt with emergency detection and qualification instructions
- `src/agent/system-prompt.builder.ts` — Add emergency context, safety instructions, customer lookup results
- `src/telegram/telegram.update.ts` — Add ops channel alert posting when emergency detected
- `src/telegram/telegram.service.ts` — Add `postEmergencyAlert()` method
- `prisma/schema.prisma` — Ensure Customer model supports lookup by name/address
- `src/database/seed.service.ts` — Ensure customer data includes value tiers and history dates

## Acceptance Criteria

- **Given** a customer sends "There's water pouring through my ceiling!" in the customer channel
  **When** the bot processes the message
  **Then** the bot responds with a calm, directive tone asking about the water source and whether they can access the water main

- **Given** a customer sends "my faucet is dripping"
  **When** the bot processes the message
  **Then** the bot responds conversationally (not in emergency mode) and offers to schedule a repair

- **Given** a customer mentions "there's water near the electrical panel"
  **When** the bot processes the message
  **Then** the bot immediately responds with electrical safety instructions before asking any other questions

- **Given** a customer says "I smell gas"
  **When** the bot processes the message
  **Then** the bot tells the customer to evacuate and call 911 before anything else

- **Given** a customer named "Garcia" sends a message and Garcia exists in the customer database
  **When** the bot looks up the customer
  **Then** the bot greets them by name and does not ask for their address

- **Given** a customer provides their name as "Smith" and no Smith exists in the database
  **When** the bot processes the message
  **Then** the bot asks for their address and phone number and creates a new customer record

- **Given** an emergency is classified as Critical
  **When** the classification is complete
  **Then** an `EMERGENCY INCOMING` alert is posted to the ops channel with severity, customer info, address, issue summary, and safety concerns

- **Given** a customer sends "HELP WATER EVERYWHERE MY BASEMENT IS FLOODING!!!"
  **When** the bot processes the message
  **Then** the bot acknowledges their stress, gives immediate water shutoff instructions, and begins qualification

- **Given** a customer answers multiple qualifying questions in one message
  **When** the bot processes the message
  **Then** the bot incorporates all answers without re-asking those questions and provides shutoff instructions

- **Given** a routine issue is reported (e.g., "running toilet")
  **When** the bot processes the message
  **Then** no emergency alert is posted to the ops channel
