---
routine: develop
---
# 10: Tech Channel Role Separation

## Overview

Migrations 03-08 built the system around two channels: customer and ops. In practice, this conflates two distinct roles — Blake (the owner who needs strategic oversight) and techs (who need dispatch orders, their schedule, and nothing else). This migration separates the tech role into its own channel, cleaning up ops as Blake's strategic view and giving each tech a dedicated dispatch radio.

This is an additive layer. Everything from 03-08 still works — this migration redirects specific message flows to the right audience.

## The Problem

In the current two-group model:
- A tech has to scroll through Blake briefings, full dispatch reasoning, displaced customer analysis, and policy flex logs just to find their dispatch order
- Blake has to read through tech confirmations, "on my way" messages, and "job done" reports mixed in with his strategic briefings
- Tech pushback ("I can't leave this job") is visible to Blake in real-time, which is fine — but it's also mixed with unrelated ops noise
- There's no way for a tech to ask "what's my schedule?" without it cluttering Blake's view
- During the demo, the judge can't clearly see the separation between what Blake sees and what a tech sees

## Architecture Change

Three role types, each with a dedicated channel:

| Role | Channel | Sees | Doesn't See |
|------|---------|------|-------------|
| Customer | Customer group | Their job status, ETAs, follow-ups | Internal reasoning, tech names before confirmation, schedule details |
| Blake (Ops) | Ops group | Everything strategic: emergency alerts, dispatch decisions with reasoning, schedule rebuilds, briefings, policy flex logs, escalations | Raw tech chatter ("on my way", "job done") unless summarized |
| Tech | Tech group (one per tech) | Their schedule, their dispatch orders, their reroute notifications, requests for confirmation | Other techs' schedules, Blake's briefings, full dispatch reasoning, customer tier analysis |

### What Moves Out of Ops → Tech Channel

These messages currently go to the ops group. They should go to the specific tech's channel instead:

1. **Dispatch orders** (migration 05): `📋 DISPATCH ORDER — Marcus` → goes to Marcus's tech channel, not ops
2. **Confirmation requests**: "Please confirm you're heading there" → tech channel
3. **Schedule changes for a specific tech** (migration 06): "Your 2pm moved to 2:45" → tech channel
4. **Job details and customer context**: property notes, customer history relevant to the job → tech channel
5. **Morning schedule (per-tech view)** (migration 07): each tech gets only their own schedule in their channel

### What Stays in Ops (Blake's View)

Ops becomes a clean strategic feed:

1. **Emergency alerts** (migration 04): `🚨 EMERGENCY INCOMING` — stays in ops
2. **Dispatch decisions with reasoning** (migration 05): the full tech evaluation matrix — stays in ops
3. **Schedule rebuild** (migration 06): the full rebuilt schedule for all techs — stays in ops
4. **Blake briefing** (migration 06): `📋 BLAKE BRIEFING` — stays in ops
5. **Policy flex decisions** (migration 07): logs of autonomous decisions — stays in ops
6. **Escalations**: anything that needs Blake's input — stays in ops
7. **Pattern flags** (migration 07): exploitation detection — stays in ops

### What Moves Out of Ops → Ops (Summarized)

Tech confirmations and status updates get summarized rather than shown raw:

- Tech says "on my way" in their channel → ops gets: `✅ Marcus confirmed — en route to 742 Lakeside Dr (ETA 12 min)`
- Tech says "job done" in their channel → ops gets: `✅ Emergency at 742 Lakeside Dr completed by Marcus. Customer follow-up initiated.`
- Tech says "I can't leave this job" in their channel → ops gets: `⚠️ Marcus unable to leave current job. Re-evaluating dispatch options.`
- Tech says "running 30 min over" in their channel → ops gets: `⏰ Marcus running 30 min over at Chen. Evaluating downstream impact.`

Blake gets the signal, not the noise.

## Requirements

### Tech Group Configuration

Update environment configuration to support tech group mappings:

```
TELEGRAM_BOT_TOKEN=
TELEGRAM_CUSTOMER_GROUP_ID=
TELEGRAM_OPS_GROUP_ID=
TELEGRAM_TECH_GROUP_MARCUS=
TELEGRAM_TECH_GROUP_TYLER=
TELEGRAM_TECH_GROUP_JAKE=
TELEGRAM_TECH_GROUP_DANNY=
```

Create a tech channel registry (src/telegram/tech-channels.ts):

```typescript
interface TechChannel {
  techId: string;
  groupId: string;
}

// Maps group IDs to tech IDs and vice versa
// Loaded from environment variables at startup
```

Methods:
- `getTechByGroupId(groupId: string): string | null` — resolve which tech a message is from based on group
- `getGroupIdByTech(techId: string): string | null` — find the right group to send a message to a specific tech
- `postToTech(techId: string, message: string)` — send a message to a specific tech's channel
- `postToTechFormatted(techId: string, sections: TechMessage)` — structured dispatch message
- `broadcastToAllTechs(message: string)` — send to all tech channels (rare — e.g., weather delay)

### Message Routing Update (src/telegram/handler.ts)

Update the message handler to support three channel types:

1. Message arrives → determine channel:
   - Matches `TELEGRAM_CUSTOMER_GROUP_ID` → customer channel
   - Matches `TELEGRAM_OPS_GROUP_ID` → ops channel (Blake)
   - Matches a tech group ID → tech channel, resolved to specific tech
2. Enrich message with role context:
   - Customer channel: check for known customer, attach account
   - Ops channel: this is Blake speaking — attach ops authority context
   - Tech channel: attach tech identity and their current assignment
3. Send to Claude with channel-appropriate system prompt framing
4. Parse response for directives — expand directive set:
   - `[POST_TO_OPS: ...]` — post to ops group (unchanged)
   - `[POST_TO_CUSTOMER: ...]` — post to customer group (unchanged)
   - `[POST_TO_TECH(techId): ...]` — post to a specific tech's channel (NEW)
   - `[UPDATE_STATE: ...]` — state mutation (unchanged)

### Conversation History Per Channel

Extend the conversation manager (from migration 02) to maintain separate history for each tech channel:

- `customer` — customer group history
- `ops` — ops group history
- `tech:marcus` — Marcus's channel history
- `tech:tyler` — Tyler's channel history
- `tech:jake` — Jake's channel history
- `tech:danny` — Danny's channel history

Each channel has independent context. When Marcus asks "what's my next job?" in his channel, the agent answers from Marcus's schedule without polluting ops history.

### Dispatch Flow Update

The dispatch flow from migration 05 now splits across channels:

**Ops gets** (strategic decision):
```
🔧 DISPATCH DECISION

Emergency: Active ceiling leak at 742 Lakeside Dr, Saratoga Springs
Severity: CRITICAL

DECISION: Pulling Marcus from Johnson drain clearing

REASONING:
• Marcus: Senior-certified, 12 min from emergency. Currently on Johnson drain clearing (Tier 3, bumpable). ✅ BEST OPTION
• Tyler: Mid-level, on Chen water heater install (Tier 1, NOT bumpable). ❌ ELIMINATED
• Jake: Mid-level, 18 min away. Patterson Tier 1, bumpable. ⚠️ BACKUP
• Danny: Junior, cannot handle emergencies. ❌ ELIMINATED

Dispatching Marcus now. Will confirm when he acknowledges.
```

**Marcus's tech channel gets** (actionable order):
```
📋 EMERGENCY DISPATCH

Customer: [name]
Address: 742 Lakeside Dr, Saratoga Springs
Issue: Water pouring through ceiling, source unknown.
         Customer has shut off water main.
Property notes: Two-story, standard plumbing.
Customer notes: First-time customer. Be friendly — this is our first impression.

Drive time from your location: ~12 minutes

Please confirm you're heading there.
```

**Marcus does NOT see**: the full tech evaluation, Blake's briefing, displaced customer tier analysis, or the reasoning about why Tyler and Jake were eliminated.

### Tech-Initiated Messages

When a tech sends a message in their channel, the agent handles it based on context:

**"on my way" / "confirmed"** →
- Triggers the confirmation gate (migration 05)
- Ops gets a summary: `✅ Marcus confirmed — en route`
- Customer gets ETA
- Cascade notifications begin (migration 06)

**"job done" / "finished up here"** →
- Updates job status and tech status
- Ops gets: `✅ Job completed by Marcus at [address]`
- Customer gets follow-up message
- Agent checks if tech has next assignment

**"running 30 min over"** →
- Agent evaluates downstream impact on tech's schedule
- If next job is affected, notifies that customer
- Ops gets impact summary
- Tech gets updated schedule: "Got it. I've pushed your 2pm to 2:30. No other changes needed."

**"I can't leave this job right now"** (pushback on dispatch) →
- Agent re-evaluates backup techs
- Ops gets: `⚠️ Marcus unable to leave current job. Re-evaluating.`
- Agent posts new dispatch decision to ops and dispatch order to backup tech

**"I'm sick, heading home"** →
- Agent acknowledges in tech channel: "Take care, Marcus. I'll redistribute your jobs."
- Triggers cascade (migration 08 scenario 11)
- Ops gets full briefing
- Affected customers get notifications
- Other techs get reassigned jobs in their channels

**"what's my schedule?"** →
- Agent responds with only that tech's schedule for the rest of the day
- Does not post anything to ops

### Morning Schedule (Per-Tech View)

When `/morning` is triggered (migration 07), in addition to the full ops briefing, each tech gets their own view in their channel:

**Marcus's channel:**
```
☀️ Good morning Marcus — here's your Monday:

  9:00am — Johnson, drain clearing (1847 W Center St, Lindon)
           Tier 3 customer. Standard job. Bumpable if emergency.
  12:00pm — Garcia, faucet repair (1847 W Sage Crest Dr, Lehi)
            ⭐ VIP customer — 5 years with us. She'll probably offer you cookies.
  3:30pm — Webber, consultation (892 S 200 E, Orem)
           New customer, first time. Make a good impression.

3 jobs today. You've got buffer time built in. Have a good one.
```

Tech sees: their jobs, relevant customer notes (friendly, not strategic), and practical details.
Tech does NOT see: tier analysis, bumpability strategy, flex buffer status, or other techs' schedules.

### System Prompt Updates

Add to the system prompt:

1. **Three-channel awareness**: The agent now operates in three types of channels — customer, ops, and tech. Each has a distinct audience and communication style.

2. **Tech channel voice**: Direct, practical, collegial. Talk to techs like a capable dispatcher who respects their time. No fluff. Give them what they need to do the job: address, issue, customer notes, drive time. Don't explain the strategy — just give the order.

3. **Ops channel refinement**: Ops is now Blake's strategic view. Don't clutter it with raw tech responses. Summarize tech actions into clean status updates. Blake should be able to glance at ops and understand the state of the business without reading tech chatter.

4. **Directive expansion**: Add `[POST_TO_TECH(techId): ...]` directive format and usage rules:
   - Use when dispatching, rerouting, or updating a specific tech
   - Use when a tech asks a question and the answer should stay in their channel
   - Never post other techs' schedules or reasoning to a tech channel

5. **Channel isolation rules**:
   - Customer channel: never expose tech names before confirmation, never show internal reasoning
   - Ops channel: always show reasoning, always summarize tech actions, always include data points
   - Tech channel: only show what's relevant to that tech, keep it actionable, respect their focus

## Files to Create

- `src/telegram/tech-channels.ts` — tech channel registry and posting methods

## Files to Modify

- `src/telegram/bot.ts` — add tech group listeners, route messages from tech groups
- `src/telegram/handler.ts` — support three channel types, add `[POST_TO_TECH(techId): ...]` directive
- `src/telegram/groups.ts` — add tech posting methods (or delegate to tech-channels.ts)
- `src/agent/directives.ts` — parse `[POST_TO_TECH(techId): ...]` directives
- `src/agent/conversation.ts` — add per-tech conversation histories
- `src/prompts/system-prompt.ts` — add three-channel awareness, tech voice, ops refinement, directive expansion
- `src/telegram/startup.ts` — send per-tech morning schedule to each tech channel
- `.env.example` — add tech group ID placeholders

## Acceptance Criteria

- **Given** valid tech group IDs in environment configuration
  **When** the bot starts
  **Then** it connects to all tech groups and logs "Connected to tech channel: Marcus, Tyler, Jake, Danny"

- **Given** a dispatch decision is made (migration 05 flow)
  **When** the dispatch order is sent
  **Then** the ops group receives the full evaluation with reasoning and the dispatched tech's channel receives only the actionable dispatch order with customer/address/issue details

- **Given** Marcus receives a dispatch order in his tech channel
  **When** he responds "on my way"
  **Then** his confirmation is processed, ops gets a summarized confirmation (`✅ Marcus confirmed — en route`), and the customer gets an ETA with tech name

- **Given** a tech sends "job done" in their channel
  **When** the agent processes it
  **Then** the tech's status updates, ops gets a one-line completion summary, and the customer gets a follow-up message — the tech channel does NOT receive the ops briefing or customer notification text

- **Given** a tech sends "running 30 min over" in their channel
  **When** the agent evaluates downstream impact
  **Then** the tech gets their updated schedule in their channel, ops gets an impact summary, and affected customers are notified — each in their own channel

- **Given** `/morning` is triggered
  **When** the morning briefing is sent
  **Then** ops receives the full strategic schedule with flags and VIP notes, AND each tech receives only their own schedule in their own channel with practical details

- **Given** Marcus asks "what's my next job?" in his tech channel
  **When** the agent responds
  **Then** the response appears only in Marcus's channel with his next assignment details, and nothing is posted to ops or any other channel

- **Given** a tech pushes back on a dispatch ("I can't leave right now")
  **When** the agent processes the pushback
  **Then** the agent re-evaluates in the tech's channel, posts a summary to ops (`⚠️ Marcus unable to leave — re-evaluating`), and sends a new dispatch order to the backup tech's channel

- **Given** a tech calls in sick in their channel
  **When** the agent processes it
  **Then** the agent acknowledges in the tech's channel, redistributes jobs to other techs (each notified in their own channel), notifies affected customers, and briefs Blake in ops

- **Given** the full demo flow runs end-to-end
  **When** a judge reviews all channels simultaneously
  **Then** each channel shows only role-appropriate content: customer sees empathetic updates, Blake sees strategic decisions with reasoning, and the tech sees only their dispatch orders and schedule changes

- **Given** the agent posts a dispatch decision to ops
  **When** the ops message is inspected
  **Then** it does NOT contain raw tech chatter like "on my way" — only clean summaries of tech actions
