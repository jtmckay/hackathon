---
routine: develop
---
# 07: Judgment Layer Scenarios and Job Lifecycle

## Overview

Wire up the remaining autonomous behaviors: policy flex for loyal customers, exploitation pattern detection, job completion and follow-up flow, the morning schedule review, and flex buffer management. These scenarios go beyond the core emergency flow and show the agent operating with Blake's full judgment across everyday operational situations.

## Requirements

### Policy Flex for Loyal Customers

The agent must autonomously offer grace — no-charge callbacks, priority scheduling, upgraded response — when the situation warrants it, without escalating to Blake.

**Scenario: Mrs. Chen's water heater noise**
A Tier 1 customer (Chen, 5 years, 8 jobs) contacts the customer group after a recent water heater install saying the new water heater is making a noise she didn't expect. The agent should:
1. Recognize Chen as Tier 1 from her history
2. See that Shamrock just installed her water heater (it's on today's schedule or in recent job history)
3. Determine this is plausibly connected to Shamrock's work
4. Check that Chen has no pattern of complaints
5. Schedule a no-charge callback without escalating to Blake
6. Post to ops group: "Scheduled no-charge callback for Chen — recent install, plausible connection, Tier 1 customer with no complaint history. Per Blake's policy flex guidelines."

**Scenario: Warranty-adjacent situation**
A customer reports "you guys were just here last week and now my ceiling is leaking." The agent should:
1. Check job history — confirm Shamrock did recent work at that address
2. Acknowledge the connection immediately ("I can see we were out there recently — let me get this taken care of")
3. Prioritize the fix at no charge per Blake's "own mistakes fast" intent
4. Post to ops with the warranty flag

The prompt must make clear: the agent does NOT need Blake's approval for policy flex when all four conditions are met (loyalty + plausible connection + proportionate ask + no complaint pattern). It just logs the decision to ops.

### Exploitation Pattern Detection

The agent must hold the line — warmly but firmly — when it detects exploitation signals.

**Scenario: Pattern complainer**
A customer with 2+ prior complaints (all resolved with free callbacks, no underlying issue found) demands another free service call. The agent should:
1. Pull the customer's complaint history
2. Recognize the pattern: multiple complaints → free service → no real issue found
3. NOT offer a free callback
4. Respond warmly: "I understand the frustration. I'd like to get to the bottom of this for you. I can schedule a diagnostic visit at our standard rate of [price], and if we find something connected to our previous work, we'll absolutely make it right at no charge."
5. Post to ops with a flag: "⚠️ Pattern flag: [customer] requesting free callback. 2 prior complaints resolved with free service, no issue found. Offered paid diagnostic. Blake — flagging for your awareness."

**Scenario: Threat-based demand**
A customer leads with "I'll leave a 1-star review on Google if you don't send someone for free." The agent should:
1. Not match the aggression
2. Not offer the free service
3. Respond warmly: "I hear you, and I definitely want to make sure you're taken care of. Let me look at what's going on and find the best option for you."
4. Offer a paid diagnostic or next available appointment
5. Flag to Blake in ops: "⚠️ Customer [name] leading with review threat. Offered standard service options. Flagging for your review."

### Job Completion and Follow-Up

When a tech reports a job complete in the ops group (e.g., "Marcus: job done at the emergency"), the agent should:

1. Update the tech's status to "available"
2. Update the job status to "completed"
3. Post to ops: "✅ [Job type] at [address] completed by [tech]"
4. Message the customer group: "Hi [name], Marcus has wrapped up. How did everything go? Is the leak fully resolved?"
5. If customer confirms: "Great to hear! If you have a moment, we'd really appreciate a review — it helps other homeowners find reliable plumbing help. [link or instruction]"
6. If customer reports an issue: escalate appropriately based on severity and apply the policy flex / hold logic

### Morning Schedule Review

When the bot starts up or when `/morning` is sent in the ops group, post a comprehensive daily briefing:

```
☀️ GOOD MORNING — Monday, March 16, 2026

TODAY'S SCHEDULE:

Marcus (Senior):
  9:00am — Johnson drain clearing (Tier 3, bumpable)
  12:00pm — Garcia faucet repair (Tier 1, NOT bumpable)
  3:30pm — Webber consultation (new customer, bumpable)

Tyler (Mid):
  9:00am — Chen water heater install (Tier 1, NOT bumpable, 4-hour job)
  2:00pm — Ramirez toilet replacement (Tier 2, bumpable)

Jake (Mid):
  9:30am — Patterson drain clearing (Tier 1, bumpable)
  12:00pm — Thorpe water softener service (Tier 2, bumpable)

Danny (Junior):
  10:00am — Park faucet install (Tier 2, bumpable)

FLEX BUFFERS:
  ✅ Morning (11:00am): Available
  ✅ Afternoon (2:30pm): Available

⚠️ FLAGS:
  • Tyler is booked solid 9am-3:30pm with no flex — if his water heater install runs long, Ramirez gets bumped
  • Danny has only one job — available for reassignment if needed after noon
  • Chen water heater is non-interruptible — plan around Tyler being unavailable until 1pm

CUSTOMER NOTES:
  • Garcia (Tier 1): 5-year customer, 3 referrals — treat with care
  • Chen (Tier 1): Water heater install today — follow up tomorrow to check if everything's running smoothly
```

### Flex Buffer Management

Throughout the day, the agent should:
1. Track which flex slots have been consumed
2. After consuming a buffer: note it in ops and recommend rebuilding it in tomorrow's schedule
3. If both buffers are consumed and another emergency comes in: flag the zero-margin state in ops
4. When a second emergency arrives and a flex buffer is still available: use it before bumping existing jobs

### Prompt Updates

Add to the system prompt:
1. Policy flex decision tree with the four-condition check (loyalty + connection + proportionate + no pattern)
2. Exploitation detection signals and response templates
3. Job completion flow (tech reports done → state update → customer follow-up → review request)
4. Morning briefing format
5. Flex buffer lifecycle management rules
6. Explicit instruction: "You do NOT need Blake's approval for policy flex when all four conditions are met. Log it and move on. You DO need Blake for anything outside these bounds."

## Files to Modify

- `src/prompts/system-prompt.ts` — add policy flex logic, exploitation detection, job completion flow, morning briefing format, flex management rules

## Acceptance Criteria

- **Given** a Tier 1 customer (Chen) messages about a noise from a recently installed water heater
  **When** the agent processes the message
  **Then** it schedules a no-charge callback without escalating to Blake and posts the reasoning to ops

- **Given** a customer with 2 prior complaints (free callbacks, no issue found) demands another free service call
  **When** the agent processes the message
  **Then** it offers a paid diagnostic, does NOT offer free service, and flags the pattern to Blake in ops

- **Given** a customer opens with "I'll leave a 1-star review if you don't fix this for free"
  **When** the agent responds
  **Then** the response is warm and professional, does not match the aggression, does not offer free service, and flags the interaction to Blake in ops

- **Given** the customer with complaint history has a genuinely new and different issue
  **When** the agent evaluates the situation
  **Then** it recognizes the issue is unrelated to prior complaints and treats it on its own merits rather than automatically applying the pattern flag

- **Given** a tech messages "job done" in the ops group
  **When** the agent processes the message
  **Then** it updates the tech's status to "available", the job's status to "completed", posts confirmation to ops, and sends a follow-up message to the customer

- **Given** the customer confirms the job is resolved
  **When** the agent processes the confirmation
  **Then** it thanks them and asks for a review

- **Given** the bot starts up or `/morning` is sent in ops
  **When** the morning briefing is posted
  **Then** it includes the full schedule by tech, flex buffer status, flags for at-risk situations, and customer notes for VIPs

- **Given** the morning flex buffer has been consumed by an emergency
  **When** the agent posts the dispatch briefing
  **Then** it notes the buffer is consumed and recommends building one into tomorrow's schedule

- **Given** both flex buffers are consumed and a new emergency arrives
  **When** the agent processes the emergency
  **Then** it flags the zero-margin state in ops: "Both flex buffers consumed. This emergency requires bumping an existing job."

- **Given** a customer says "you guys were just here last week and now my ceiling is leaking"
  **When** the agent responds
  **Then** it acknowledges the connection to prior work in the first message, does not deflect or ask for proof, and treats it as a warranty situation

- **Given** a policy-flex decision is made
  **When** the ops group post is inspected
  **Then** it cites which of the four conditions were met and why the decision was made without Blake's input
