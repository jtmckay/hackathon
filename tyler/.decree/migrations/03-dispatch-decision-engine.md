---
routine: develop
---
# 03: Dispatch Decision Engine — Tech Evaluation and Autonomous Dispatch

## Overview

Build the core dispatch brain. When an emergency is classified, the agent evaluates every tech simultaneously on availability, skill match, proximity, current job bumpability, and customer value of their current job. It applies Blake's intent hierarchy to pick the best tech, posts its decision with full reasoning to the ops channel, sends dispatch details to the tech, and gives the customer an ETA. This is the most important migration — it's where the agent demonstrates genuine autonomous judgment.

**Stack:** NestJS + Prisma + SQLite + `@anthropic-ai/sdk` + `nestjs-telegraf` (long polling) — all open-source.

**Telegram model:** Single unified group chat (see migration 01). All references to "ops channel" or "customer channel" below refer to the unified group. When `MULTI_CHANNEL_ENABLED=true`, these become separate channels.

## Requirements

### Tech Evaluation
- For each tech, evaluate these dimensions and score them:
  - **Current job status**: not_started / in_progress / almost_done / completed. Mid-install jobs (like water heater) marked `bumpable: false` cannot be interrupted.
  - **Skill match**: Does the tech have the certifications needed? Gas leak → gas-certified only. General emergency → mid+ seniority.
  - **Proximity**: Estimated drive time from tech's current location to emergency address. Use hardcoded drive time estimates from service area data (this is a demo, not GPS).
  - **Current customer value**: Is the tech currently serving a Tier 1 (VIP), Tier 2 (Regular), or Tier 3 (New) customer?
  - **Job bumpability**: Is the current job safe to pause/reschedule? `bumpable` flag + context.

### Intent Hierarchy (from Blake's statements)
Apply these rules in order during tech selection:
1. **Emergency calls get same-day response, no exceptions** — someone must be dispatched
2. **Never send a junior tech to an emergency alone** — Danny cannot be dispatched to emergencies solo. If only Danny is available, escalate to Blake.
3. **Repeat customers' jobs get bumped last** — when choosing whose job to displace, Tier 3 (new) first, then Tier 2, then Tier 1 only if no alternative
4. **If two techs are equally viable, pick the closer one** — proximity is the tiebreaker
5. **Safety first** — never pull a tech mid-gas-work or mid-water-heater-install if interruption creates risk

### Decision Output (Ops Channel)
- Post decision with full reasoning to ops channel via `TelegramService`:
  ```
  📋 DISPATCH DECISION

  SENDING: Marcus (Senior, 8 yrs)
  REASON: Gas-certified, 12 min from emergency address.
  Currently on: Johnson drain clearing (Tier 3, new customer, routine, bumpable)

  CONSIDERED:
  • Tyler — ❌ Mid water heater install for Chen (Tier 1, cannot safely pause)
  • Jake — ⚠️ Viable but 25 min away, no gas cert
  • Danny — ❌ Junior, cannot dispatch to emergency alone (Intent #3)

  DISPLACED JOBS:
  • Johnson drain clearing — PAUSED, needs rescheduling
  • Garcia faucet repair (12:00) — needs reassignment
  • Webber consultation (3:30) — needs rescheduling
  ```

### Dispatch Action
- Update schedule in database via Prisma: remove emergency tech from their current/upcoming jobs, insert emergency job
- Mark displaced jobs with status `needs_rescheduling`
- Post dispatch order to ops channel tagged to the tech
- Post ETA and tech info to customer channel

### Schedule Mutation
- `ScheduleService` (or extend `PrismaService`) with methods:
  - `getAvailableTechs(requiredSkills, minSeniority)` — returns all techs with current status
  - `assignEmergency(techId, emergencyJob)` — inserts emergency, pauses current job
  - `markDisplaced(techId)` — marks all future jobs for that tech as needs_rescheduling
  - `getDisplacedJobs(techId)` — returns list of jobs that need handling

### Edge Case: No Tech Available
- If no tech can be safely dispatched:
  - Post to ops channel: "⚠️ ALL TECHS UNAVAILABLE — Escalating to Blake"
  - Message customer: "I'm coordinating with our owner Blake directly to get someone to you as fast as possible."

### Edge Case: Only Junior Available
- If only Danny is available:
  - Do NOT dispatch Danny alone (Intent #3)
  - Check if any tech is close to finishing current job
  - If yes: pair Danny with the next-available tech
  - If no: escalate to Blake

## Files to Modify (relative to `hackathon-bot/`)
- `src/agent/agent.service.ts` — Add dispatch decision context to system prompt, expose schedule query tools
- `src/agent/system-prompt.builder.ts` — Include tech evaluation data and intent hierarchy
- `prisma/schema.prisma` — Ensure ScheduledJob status enum includes paused/needs_rescheduling
- `src/database/seed.service.ts` — Ensure drive time estimates are in tech data
- `src/telegram/telegram.update.ts` — Handle dispatch flow trigger after emergency classification
- `src/telegram/telegram.service.ts` — Add `postDispatchDecision()`, `postDispatchOrder()`, `postCustomerETA()` methods

## Acceptance Criteria

- **Given** an emergency is classified and 4 techs are on the schedule
  **When** the dispatch engine evaluates techs
  **Then** every tech is scored on skill match, proximity, availability, current customer tier, and bumpability

- **Given** Marcus is on a bumpable Tier 3 job and Tyler is mid-install on an un-bumpable Tier 1 job
  **When** the dispatch engine selects a tech
  **Then** Marcus is selected and Tyler is excluded with reason "cannot safely pause"

- **Given** the dispatch decision is made
  **When** the decision is posted to the ops channel
  **Then** the post includes: selected tech with reason, all considered techs with accept/reject reasoning, and list of displaced jobs

- **Given** Marcus is dispatched to the emergency
  **When** the schedule is updated
  **Then** Marcus's current job status changes to "paused", his future jobs are marked "needs_rescheduling", and the emergency job is inserted into his schedule

- **Given** the customer is waiting after reporting an emergency
  **When** a tech is dispatched
  **Then** the customer receives the tech's name, approximate ETA, and interim safety/protection instructions

- **Given** all techs are on un-bumpable critical jobs
  **When** the dispatch engine evaluates techs
  **Then** the ops channel receives an escalation alert and the customer is told Blake is being contacted directly

- **Given** only Danny (junior) is available
  **When** the dispatch engine evaluates techs
  **Then** Danny is NOT dispatched alone; the system either pairs him with the next-available tech or escalates to Blake

- **Given** Jake and Marcus are both viable candidates with similar scores
  **When** Marcus is 12 min away and Jake is 25 min away
  **Then** Marcus is selected with proximity cited as the tiebreaker

- **Given** the emergency requires gas certification
  **When** Jake (no gas cert) and Marcus (gas cert) are both available
  **Then** Marcus is selected and Jake is excluded with reason "missing gas certification"

- **Given** a dispatch order is sent to the ops channel
  **When** a tech views it
  **Then** it includes: customer name, address, issue description, safety notes, customer history, and instructions about their paused job
