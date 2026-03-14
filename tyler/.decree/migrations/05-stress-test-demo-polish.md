---
routine: develop
---
# 05: Stress Testing, Edge Cases, and Demo Polish

## Overview

Harden the system against curveball scenarios the judges will throw, add job resolution and follow-up flow, build the `/reset` demo flow, and polish the bot's tone to sound like Blake's business. This is the final migration — after this, the system should handle anything a judge throws at it during a live demo.

**Stack:** NestJS + Prisma + SQLite + `@anthropic-ai/sdk` + `nestjs-telegraf` (long polling) — all open-source.

**Telegram model:** Single unified group chat (see migration 01). All references to "ops channel" or "customer channel" below refer to the unified group. When `MULTI_CHANNEL_ENABLED=true`, these become separate channels.

## Requirements

### Curveball Scenarios to Handle

**Double Emergency:**
- While a tech is already on an emergency, a second emergency comes in
- Bot must evaluate remaining techs (now only 2-3 available), apply same logic
- If stretched thin, bot acknowledges the difficulty: "This is an unusual situation — we have two emergencies at once."

**All Techs Unavailable:**
- Every tech is on un-bumpable critical work
- Bot escalates to Blake with full context
- Customer gets: "This is an exceptional situation. I'm contacting our owner Blake directly."

**Hysterical Customer:**
- ALL CAPS, repeated messages, barely coherent
- Bot stays calm, acknowledges emotion, extracts info gently
- Never matches the customer's energy — always de-escalates

**False Emergency:**
- Customer says "emergency" but describes a dripping faucet
- Bot correctly downgrades and offers to schedule a repair

**After Hours:**
- Emergency comes in outside business hours
- Bot acknowledges after-hours surcharge from `config/business.json`

**Repeat Customer Emergency:**
- A VIP customer has the emergency
- Bot treats with extra warmth, references their history

**Previous Shamrock Job Caused It:**
- Customer says "you guys were just here last week"
- Bot applies Intent #6: own mistakes fast, offer fix at no charge
- Flag in ops channel: "⚠️ POSSIBLE CALLBACK"

**Customer Asks About Cost:**
- Bot provides range from job catalog, assures no surprises (Intent #4)

**Tech Pushback:**
- Tech messages "I can't leave this job right now"
- Bot evaluates validity and moves to next-best tech if needed

**Multiple Simultaneous Disruptions:**
- Emergency + tech sick + job running long in the same hour
- Bot handles sequentially, rebuilding schedule after each

### Job Resolution Flow
- When a tech messages "job complete" or similar in ops channel:
  - Update `ScheduledJob` status to `completed` via TypeORM
  - Update tech status to `available`
  - Post follow-up to customer: "Marcus has wrapped up. How did everything go?"
  - If customer confirms: ask for review, log job
  - If customer reports issue: escalate based on severity
  - Create `JobLog` entry with outcome

### Demo Reset Flow
- `/reset` command in ops channel:
  - Truncate schedule, conversation history, job logs via Prisma (`deleteMany`)
  - Re-seed database from config JSON files
  - Post fresh schedule to ops channel
  - Confirm: "✅ System reset to Monday morning."
- Must complete in under 3 seconds for live demo

### Tone Polish
- Customer channel: warm, confident, specific. Uses tech names. Concrete next steps. Never says "I'm an AI"
- Ops channel: crisp, data-driven, decisive. Shows reasoning. Clean formatting.
- Never hedges — the bot IS the dispatcher

### White-Label Readiness
- All business-specific strings come from `config/` (company name, owner name, tech names, pricing)
- Intent statements loaded from `config/intent-statements.json`, not hardcoded
- A new business swaps their `config/` directory and the system works without code changes

## Files to Modify (relative to `hackathon-bot/`)
- `src/agent/agent.service.ts` — Enhanced system prompt with edge case handling, tone guidelines, resolution flow
- `src/agent/system-prompt.builder.ts` — Add curveball context, after-hours logic, callback detection
- `src/database/seed.service.ts` — Add `resetAll()` method for demo reset via Prisma
- `prisma/schema.prisma` — Ensure JobLog model supports completion logging
- `src/telegram/telegram.update.ts` — `/reset` handler, job completion detection, curveball routing
- `src/telegram/telegram.service.ts` — Add `postJobResolution()`, `postCallbackAlert()` methods

## Acceptance Criteria

- **Given** one emergency is already being handled and Marcus is dispatched
  **When** a second emergency comes in
  **Then** the bot evaluates the remaining 3 techs and dispatches the best available one with full reasoning

- **Given** all 4 techs are on un-bumpable jobs
  **When** an emergency comes in
  **Then** the bot posts an escalation to Blake in ops and tells the customer Blake is being contacted directly

- **Given** a customer sends "HELP HELP WATER EVERYWHERE OH GOD WHAT DO I DO!!!"
  **When** the bot responds
  **Then** the response is calm, provides immediate safety instructions, and does not match the panicked tone

- **Given** a customer says "emergency" but describes a dripping faucet
  **When** the bot classifies the issue
  **Then** severity is set to Routine and the bot offers to schedule a repair instead of dispatching

- **Given** an emergency comes in at 9:00pm
  **When** the bot processes it
  **Then** the bot mentions the after-hours surcharge from config before dispatching

- **Given** a customer says "you guys were just here last week and now my ceiling is leaking"
  **When** the bot processes the message
  **Then** the bot apologizes, offers to fix at no charge, and flags "POSSIBLE CALLBACK" in the ops channel

- **Given** a customer asks "how much is this going to cost?" during an emergency
  **When** the bot responds
  **Then** it provides the price range from the job catalog and assures no cost surprises

- **Given** a tech messages "job complete" in the ops channel
  **When** the bot processes the message
  **Then** the tech's status updates to available, the job is logged as completed, and the customer receives a follow-up message

- **Given** the `/reset` command is sent in the ops channel
  **When** the bot processes the command
  **Then** the database is re-seeded, a fresh schedule is posted, and it completes in under 3 seconds

- **Given** the config directory is swapped with a different business's data
  **When** the app starts
  **Then** the bot operates using the new business's name, techs, customers, pricing, and intent statements without any code changes
