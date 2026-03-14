---
routine: develop
---
# 04: Cascade Recovery — Displaced Job Handling, Schedule Rebuild, and Customer Notifications

## Overview

When a tech is pulled for an emergency, their remaining jobs need handling. This migration builds the cascade: for each displaced job, the agent decides whether to reassign to another tech or reschedule, applies intent-based customer treatment (VIP customers get priority rebook and personal apology, new customers get professional reschedule), sends differentiated notifications, rebuilds the full schedule, and posts a Blake briefing summarizing all decisions.

**Stack:** NestJS + Prisma + SQLite + `@anthropic-ai/sdk` + `nestjs-telegraf` (long polling) — all open-source.

**Telegram model:** Single unified group chat (see migration 01). All references to "ops channel" or "customer channel" below refer to the unified group. When `MULTI_CHANNEL_ENABLED=true`, these become separate channels.

## Requirements

### Displaced Job Handler
For each job displaced by the emergency dispatch (from `needs_rescheduling` status):
1. **Can another tech pick it up today?**
   - Query all other techs' schedules via Prisma for open slots
   - Skill match required (don't assign gas work to uncertified tech)
   - Prefer minimal schedule disruption (slot the job into a natural gap)
2. **If yes → Reassign**
   - Update `ScheduledJob` model via Prisma: new techId, adjusted time
   - Status changes from `needs_rescheduling` to `scheduled`
3. **If no → Reschedule to next available day**
   - Find the earliest slot for the original tech (or any qualified tech)
   - Status changes to `rescheduled`

### Intent-Based Customer Treatment
Different customers get different messages based on their value tier:

**Tier 1 (VIP) — Garcia, Chen, Patterson:**
- Personal apology referencing their loyalty
- Priority rebook to earliest available slot
- Same-day service preserved if at all possible (reassign to another tech)
- Example: "Hi Mrs. Garcia, I'm so sorry about the shuffle today — we had an emergency come in. I've got Tyler coming to take care of your faucet at 3:00pm instead. Same great work, just a different tech. Thank you for your patience — we really value you."

**Tier 2 (Regular) — Ramirez, Thorpe, Park:**
- Professional, warm notification
- Reschedule to earliest convenient slot
- Example: "Hi, this is Shamrock Plumbing. We need to adjust your appointment today due to an emergency. I can have Tyler there at [time]. Would that work for you?"

**Tier 3 (New) — Johnson, Webber:**
- Professional but brief
- Rescheduled to next available (not priority)
- Example: "Hi, we need to reschedule your appointment due to an emergency. I have [day] at [time] available. Would that work?"

### Schedule Rebuild
After all displaced jobs are handled, post the complete updated schedule to ops via `TelegramService`:
```
📅 SCHEDULE UPDATE (post-emergency)

Marcus:
  ⚡ NOW: Emergency — [address] — active ceiling leak
  Est. completion: 1:30pm
  2:00pm: OPEN
  3:30pm: OPEN

Tyler:
  9:00am: Water heater install — Chen (in progress, unchanged)
  1:00pm: Drain clearing — Johnson (picked up from Marcus)
  3:00pm: Faucet repair — Garcia (moved from Marcus 12:00)

Jake:
  9:30am: Drain clearing — Patterson (in progress, unchanged)
  12:00pm: Water softener — Thorpe (unchanged)

Danny:
  10:00am: Faucet install — Park (in progress, unchanged)

DISPLACED → RESCHEDULED:
  • Webber consultation → Thursday 1:00pm (Marcus)

ALL AFFECTED CUSTOMERS NOTIFIED ✓
```

### Blake Briefing
Post a summary for Blake in the ops channel via `TelegramService.postBlakeBriefing()`.

### Additional Disruption: Tech Calls In Sick
- When a message like "I'm feeling sick, need to go home" comes from a tech in the ops channel:
  - Identify the tech from the message
  - Pull all their remaining jobs for the day
  - Run the same cascade logic: reassign what you can, reschedule the rest
  - Post schedule rebuild and Blake briefing
  - Respond to the tech: "Feel better, [name]. I've redistributed your jobs for today."

### Additional Disruption: Job Running Long
- When a tech reports "this job is going to take longer than expected":
  - Identify which job and how much longer
  - Check if this pushes into their next appointment
  - If yes: notify the next customer with updated ETA or reschedule
  - Update schedule and post changes to ops channel

## Files to Modify (relative to `hackathon-bot/`)
- `src/agent/agent.service.ts` — Add cascade logic, customer notification templates to system prompt
- `src/agent/system-prompt.builder.ts` — Include displaced job context and notification guidelines
- `prisma/schema.prisma` — Ensure ScheduledJob model has reassignment and reschedule fields
- `src/telegram/telegram.update.ts` — Handle tech sick/delay messages, trigger cascade
- `src/telegram/telegram.service.ts` — Add `postScheduleRebuild()`, `postBlakeBriefing()`, `notifyCustomer()` methods

## Acceptance Criteria

- **Given** Marcus has been pulled for an emergency and has 3 displaced jobs (Johnson, Garcia, Webber)
  **When** the cascade handler processes displaced jobs
  **Then** each job is individually evaluated for reassignment vs. reschedule

- **Given** Garcia is a Tier 1 VIP customer whose job was displaced
  **When** the cascade handler processes Garcia's job
  **Then** Garcia's job is reassigned to another tech same-day (if any slot exists) and she receives a personal apology mentioning her loyalty

- **Given** Webber is a Tier 3 new customer whose consultation was displaced
  **When** the cascade handler processes Webber's job
  **Then** Webber's job is rescheduled to the next available day with a brief, professional notification

- **Given** Tyler has a gap in his schedule from 1:00-3:00pm
  **When** Johnson's drain clearing (1-2 hrs) needs reassignment
  **Then** it is reassigned to Tyler at 1:00pm

- **Given** all displaced jobs have been handled
  **When** the schedule rebuild is posted
  **Then** the ops channel shows the complete updated schedule with all techs, all times, and a list of rescheduled jobs

- **Given** all cascade decisions are complete
  **When** the Blake briefing is posted
  **Then** it includes: what happened, which tech was pulled, each cascade decision with reasoning, all customer notifications sent, and revenue impact

- **Given** a tech sends "I'm sick, going home" in the ops channel
  **When** the bot processes the message
  **Then** the bot pulls their remaining jobs, runs the cascade, posts a rebuilt schedule, and responds to the tech

- **Given** a tech reports "this install is going to take 2 extra hours"
  **When** the bot processes the message
  **Then** the bot checks if this impacts the next scheduled job and notifies the affected customer if so

- **Given** a Tier 1 customer and a Tier 3 customer both need rescheduling
  **When** the cascade handler assigns priority
  **Then** the Tier 1 customer gets the better slot (earlier, same-day if possible) and the Tier 3 customer gets what's left

- **Given** no other tech has availability to pick up a displaced job today
  **When** the cascade handler evaluates the job
  **Then** it is rescheduled to the next available day and the customer is notified with the new date/time
