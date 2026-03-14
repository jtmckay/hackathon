---
routine: develop
---
# 04: Emergency Intake and Qualification

## Overview

Build the emergency intake flow: the agent detects urgency from natural language, asks targeted qualifying questions, classifies severity, provides safety instructions, and posts an alert to the ops group. This is the customer-facing side of emergency handling — dispatch comes in migration 05.

## Requirements

### Emergency Detection and Classification

The agent must handle this entirely through the system prompt and Claude's reasoning — no hardcoded keyword matching. Update the system prompt to include detailed instructions for:

**Urgency detection from natural language:**
- Critical signals: "flooding", "pouring", "burst", "gas smell", "sewage", "water everywhere", "ceiling is leaking", "pipe broke", emotional distress, ALL CAPS, multiple exclamation marks
- Urgent signals: "no hot water" (especially in winter), "leak", "backing up", "won't drain", "running constantly"
- Routine signals: "dripping", "slow drain", "running toilet", "want a quote", "thinking about replacing"
- The agent should recognize urgency even when the customer doesn't use technical terms ("brown stuff coming up in my shower" = sewage backup)

**Severity classification:**
- **Critical:** Active flooding, gas smell, sewage backup, electrical risk near water, water pouring through ceiling/walls. Triggers immediate dispatch.
- **Urgent:** Contained leak, no hot water in cold weather, single fixture backup, water heater making unusual noise. Same-day dispatch, may not need to bump existing jobs.
- **Routine:** Dripping faucet, slow drain, running toilet, consultation request. Schedule at next available slot.

**Qualifying questions** (asked conversationally, not as a form):
- Where is the water coming from? (ceiling, walls, floor, fixture, unknown)
- Can you see the source? (burst pipe, overflowing fixture, water heater, unknown)
- How much water? / Is it actively flowing or has it stopped?
- Have you shut off the water main? (if not, provide instructions)
- Is there electrical near the water? (panels, outlets, appliances)
- Do you smell gas?
- What's your address? (or confirm address if they're a known customer)
- Is anyone in danger?

The agent should NOT ask all of these sequentially like a checklist. It should ask the most critical 2-3 based on what the customer already said, weave in safety instructions as needed, and move to action as fast as possible. A panicked customer saying "water is pouring through my ceiling" should not be asked 8 questions before getting help.

**Safety response logic (immediate, before any other questions):**
- Gas smell → "Get everyone out of the house right now. Don't touch any light switches. Call 911 from outside. I'll have a tech heading your way as soon as you're safe."
- Electrical risk near water → "Stay away from the water if it's near any electrical outlets or your breaker panel. If you can safely get to your main electrical panel, shut off the breaker for that area."
- Active flooding → "Let's get the water stopped. Your main shutoff valve is usually near where the water line enters your house — often in the basement or near the water heater. It's a round handle or a lever. Turn it clockwise or to the perpendicular position."

### Customer Recognition

When a message comes in on the customer group, the agent should:
1. Check if the sender matches a known customer (by name or if metadata provides a phone/ID match)
2. If known: greet by name, reference their address ("Are you at 1155 E 200 S?"), skip asking for information already on file
3. If unknown: collect name and address naturally in the conversation
4. If the customer had recent Shamrock work: note it internally for the warranty/own-mistakes logic

### Ops Group Alert

When the agent determines a situation is critical or urgent, it must post to the ops group via the `[POST_TO_OPS: ...]` directive. The alert should include:

```
🚨 EMERGENCY INCOMING

Severity: CRITICAL
Customer: [name] ([tier])
Address: [address]
Issue: [description in plain terms]
Safety status: [water main status, electrical risk, gas risk]
Customer status: [known/new, recent Shamrock work if any]

Awaiting dispatch decision...
```

For urgent (non-critical) situations, use a less alarming format:
```
⚠️ URGENT SERVICE REQUEST

Customer: [name] ([tier])
Address: [address]
Issue: [description]
Recommended: Same-day dispatch if slot available

Checking schedule for availability...
```

### Non-Emergency Handling

If the customer's issue is routine, the agent should:
- Acknowledge it warmly
- Not trigger emergency flow
- Check the schedule for the next available slot
- Offer to book it
- Post a note to ops group (not an alert, just a log entry)

### Prompt Updates

Add the following sections to the system prompt (in `src/prompts/system-prompt.ts`):

1. Emergency intake instructions (detection, classification, qualifying questions, safety responses)
2. Customer recognition instructions
3. Clear guidance on using `[POST_TO_OPS: ...]` directive format for emergency alerts
4. Instruction to NEVER expose ops-group reasoning in customer-group responses (don't tell the customer "I'm evaluating which tech to pull from another job")

## Files to Modify

- `src/prompts/system-prompt.ts` — add emergency intake instructions, safety protocols, customer recognition logic, and ops alert format

## Acceptance Criteria

- **Given** a customer sends "water is pouring through my ceiling" in the customer group
  **When** the agent responds
  **Then** the response includes water main shutoff instructions within the first message and does not ask more than 2-3 follow-up questions before indicating help is on the way

- **Given** a customer sends "I smell gas in my basement"
  **When** the agent responds
  **Then** the first sentence instructs them to evacuate and call 911, before any qualifying questions

- **Given** a customer sends "my faucet has been dripping for a week"
  **When** the agent responds
  **Then** the agent treats it as routine (not emergency), offers to schedule an appointment, and does NOT post an emergency alert to the ops group

- **Given** a customer sends "water is pouring through my ceiling"
  **When** the agent's response is parsed for directives
  **Then** a `[POST_TO_OPS: ...]` directive is present containing an emergency alert with severity, customer info, and issue description

- **Given** a known Tier 1 customer (Garcia) sends a message
  **When** the agent responds
  **Then** the response addresses them by name and references their address on file rather than asking for it

- **Given** an unknown person sends an emergency message
  **When** the agent responds
  **Then** the agent provides safety instructions immediately and asks for name and address naturally within the conversation, not as a gating prerequisite

- **Given** a customer sends "you guys were here last week and now my ceiling is leaking"
  **When** the agent responds
  **Then** the agent acknowledges the connection to prior Shamrock work immediately, does NOT deflect, and the ops group alert includes a note about the potential warranty situation

- **Given** a customer sends "HELP water everywhere I don't know what to do my kids are here"
  **When** the agent responds
  **Then** the response is calm, reassuring, gives one clear safety instruction first, and does not mirror the panic or ask for a detailed description before helping

- **Given** a customer describes a situation with water near electrical outlets
  **When** the agent responds
  **Then** the response includes electrical safety instructions (stay away from water near outlets, shut off breaker if safe to do so)

- **Given** a customer sends "my toilet is running and also I have no hot water"
  **When** the agent classifies severity
  **Then** it prioritizes the higher-severity issue (no hot water = urgent) over the lower one (running toilet = routine)

- **Given** a customer describes an urgent but non-critical issue (e.g., "my kitchen sink is leaking but I put a bucket under it")
  **When** the agent responds
  **Then** it classifies as urgent (not critical), acknowledges they've contained it, and offers same-day service without triggering the full emergency cascade
