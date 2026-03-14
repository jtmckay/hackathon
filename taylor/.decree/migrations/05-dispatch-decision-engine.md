---
routine: develop
---
# 05: Dispatch Decision Engine with Tech Confirmation Gate

## Overview

Build the core dispatch logic: when an emergency is confirmed, the agent evaluates all techs simultaneously, selects the best one using Blake's intent hierarchy, posts its full reasoning to the ops group, dispatches the tech, and waits for tech confirmation before notifying the customer of an ETA. This is the decision-making heart of the system.

## Requirements

### Tech Evaluation Logic

When an emergency requires dispatch, the agent must evaluate every tech against these criteria (all encoded in the system prompt — the agent reasons over data, it does not run scoring functions):

1. **Skill match:** Does the tech have the skills/certifications for this emergency type? Gas leak → needs gas certified tech. General emergency → mid+ seniority.
2. **Availability/interruptibility:** What is the tech currently doing? Can it be safely paused? A water heater install mid-way CANNOT be safely paused. A drain clearing CAN be paused. A consultation CAN be paused.
3. **Proximity:** How far is the tech from the emergency address? Use the drive time matrix from the service area data.
4. **Current customer value:** Is the tech currently serving a Tier 1 customer? Blake's rules say: bump Tier 3 first, Tier 2 second, Tier 1 last.
5. **Job bumpability:** Is the current job flagged as bumpable? Non-bumpable jobs (e.g., mid-install water heater) should not be interrupted regardless of other factors.
6. **Seniority:** Junior techs (Danny) are NEVER dispatched to emergencies alone. If Danny is the only option, escalate to Blake.

### Intent Hierarchy for Dispatch Selection

When multiple techs could be pulled, the agent applies this hierarchy:

1. **Eliminate ineligible techs:** no skill match, currently on non-bumpable/non-interruptible job, junior seniority
2. **Prefer techs serving lower-tier customers:** pulling from a Tier 3 customer's job before a Tier 1's
3. **Prefer closer techs:** shorter drive time to emergency = faster response
4. **Prefer higher seniority for complex emergencies:** senior for gas/structural, mid for standard leaks
5. **Tiebreaker:** if two techs are equally viable, prefer the one whose current job is easiest to reschedule (consultation > routine repair > complex job)

### Dispatch Decision Post (Ops Group)

After evaluating, the agent posts its decision to the ops group with FULL reasoning:

```
🔧 DISPATCH DECISION

Emergency: Active ceiling leak at 742 Lakeside Dr, Saratoga Springs
Severity: CRITICAL

DECISION: Pulling Marcus from Johnson drain clearing

REASONING:
• Marcus: Senior-certified, 12 min from emergency. Currently on Johnson drain clearing (Tier 3, bumpable, can be safely paused). ✅ BEST OPTION
• Tyler: Mid-level, 20 min away. Currently on Chen water heater install (Tier 1, NOT bumpable, cannot be safely paused mid-install). ❌ ELIMINATED
• Jake: Mid-level, 18 min away. Currently on Patterson drain clearing (Tier 1, bumpable, could be paused). Viable but farther and would displace a Tier 1 customer. ⚠️ BACKUP
• Danny: Junior, 35 min away. Junior techs cannot be dispatched to emergencies alone. ❌ ELIMINATED

Displaced jobs:
• Johnson drain clearing (Marcus, 9:00am) — PAUSED, needs rescheduling
• Garcia faucet repair (Marcus, 12:00pm) — needs reassignment or reschedule
• Webber consultation (Marcus, 3:30pm) — needs reschedule

Awaiting Marcus's confirmation before notifying affected customers.
```

### Dispatch Order to Tech (Ops Group)

After the decision is posted, the agent sends a dispatch order directed at the chosen tech:

```
📋 DISPATCH ORDER — Marcus

EMERGENCY: Active water leak through ceiling
Customer: [name]
Address: 742 Lakeside Dr, Saratoga Springs
Issue: Water pouring through ceiling, source unknown. Customer has shut off water main.
Customer notes: [any relevant history]

Please confirm you're heading there. Affected customers will NOT be notified until you confirm.
```

### Tech Confirmation Gate

This is critical: **the agent must NOT notify displaced customers or give the emergency customer an ETA until the dispatched tech has confirmed.**

The flow:
1. Agent posts dispatch order to ops group
2. Agent tells the emergency customer: "I'm dispatching one of our senior technicians to you right now. I'll have a name and ETA for you shortly."
3. Agent waits for a message from the tech in the ops group (e.g., "heading there now", "on my way", "confirmed", or any affirmative response from someone identified as the dispatched tech)
4. **After confirmation:** Agent updates customer with specific ETA and tech name. Agent begins notifying displaced customers (migration 06).
5. **If no confirmation within a reasonable period:** Agent posts a flag to ops: "⚠️ Marcus has not confirmed dispatch. Blake — please advise." Agent does NOT send speculative ETAs to anyone.

The confirmation detection should be flexible — the tech won't type a magic keyword. The agent should recognize confirmations from context: "on my way", "heading out", "got it", "roger", "leaving now", "yeah I'll head there", etc., as long as it comes from the right person.

### State Updates After Dispatch

When a dispatch decision is made, the agent must update state via `[UPDATE_STATE: ...]` directives:

1. Update dispatched tech's status to "en_route" and currentJobId to the emergency
2. Update the dispatched tech's current job status to "paused"
3. Mark the emergency as a new job in the schedule
4. Mark downstream jobs for the dispatched tech as "needs_rescheduling"
5. Consume a flex buffer slot if one is available for the emergency

### No-Tech-Available Escalation

If ALL techs are eliminated (everyone is on non-bumpable jobs or only Danny is available):
- Agent posts to ops: "🚨 ESCALATION REQUIRED — No eligible tech available for emergency dispatch. All senior/mid techs on non-interruptible jobs. Blake — need your call on this."
- Agent tells the customer: "I'm working on getting a technician to you as quickly as possible. I need just a couple minutes to coordinate — I haven't forgotten about you."
- Agent does NOT make up an ETA or dispatch an unqualified tech

### Prompt Updates

Add to the system prompt:
1. Tech evaluation criteria and intent hierarchy (structured as described above)
2. Dispatch decision format for ops group
3. Dispatch order format for ops group
4. Tech confirmation gate rules — explicit instruction that NO customer-facing ETAs are sent until tech confirms
5. State update directive format for dispatch-related mutations
6. No-tech-available escalation protocol
7. Instruction that the agent should reference specific data points in its reasoning (actual drive times, actual customer tiers, actual job bumpability flags)

## Files to Modify

- `src/prompts/system-prompt.ts` — add dispatch decision instructions, tech evaluation criteria, confirmation gate rules, state update directives

## Acceptance Criteria

- **Given** a critical emergency at 742 Lakeside Dr, Saratoga Springs with the Monday schedule active
  **When** the agent processes the emergency in the ops group
  **Then** it evaluates all 4 techs and selects Marcus, citing his seniority, proximity, and the fact that Johnson is Tier 3 and bumpable

- **Given** a critical emergency has been posted
  **When** the agent posts its dispatch decision to the ops group
  **Then** the decision includes a line-by-line evaluation of every tech with status (✅, ❌, ⚠️) and specific reasoning for each

- **Given** Marcus has been dispatched
  **When** the emergency customer asks "when will someone be here?"
  **Then** the agent responds that a tech is on the way and they'll have a specific ETA shortly — NOT a specific time, because Marcus hasn't confirmed yet

- **Given** Marcus has been dispatched and has NOT yet confirmed
  **When** any message arrives that is not Marcus's confirmation
  **Then** no displaced customer notifications are sent and no specific ETAs are given to the emergency customer

- **Given** Marcus has been dispatched
  **When** a message from Marcus saying "on my way" appears in the ops group
  **Then** the agent recognizes this as confirmation, posts "✅ Marcus confirmed — en route" to ops, and sends the customer a specific ETA with Marcus's name

- **Given** Marcus has been dispatched and confirmed
  **When** the agent updates state
  **Then** Marcus's status is "en_route", Johnson's job status is "paused", and the emergency job appears in the schedule

- **Given** Tyler is mid-install on a water heater (non-bumpable job)
  **When** the agent evaluates Tyler for dispatch
  **Then** Tyler is eliminated from consideration with reasoning: "Cannot be safely paused mid-install, Tier 1 customer"

- **Given** only Danny (junior) is available
  **When** the agent evaluates dispatch options
  **Then** it escalates to Blake in the ops group rather than dispatching Danny alone

- **Given** the emergency address is in Saratoga Springs
  **When** the agent evaluates tech proximity
  **Then** it references specific drive times from the service area data (not made-up numbers)

- **Given** a flex buffer slot is available
  **When** an emergency is dispatched
  **Then** the agent consumes the appropriate flex slot and notes this in the ops group

- **Given** the dispatch decision has been made
  **When** the ops group post is inspected
  **Then** it lists all displaced jobs for the dispatched tech with their current status
