---
routine: develop
---
# 06: Cascading Schedule Rebuild and Tier-Aware Notifications

## Overview

After a tech is dispatched to an emergency and confirms, every displaced job must be handled: reassigned to another tech if possible, rescheduled if not. Each affected customer receives a notification calibrated to their relationship tier. The rebuilt schedule is posted to the ops group, and Blake gets a full briefing. This migration completes the end-to-end emergency flow.

## Requirements

### Displaced Job Handler

When a tech is pulled for an emergency, the agent must identify and handle every affected job on that tech's schedule for the rest of the day. For each displaced job, the agent decides:

**Reassign (preferred):** Move the job to another tech who:
- Has the skill/certification for the job type
- Has an open slot at a compatible time (including flex buffer slots)
- Is not currently on a non-interruptible job
- Prioritize reassignment for higher-tier customers

**Reschedule (fallback):** If no tech can pick up the job today:
- Find the earliest available slot in the next 5 business days
- Higher-tier customers get the earliest slots
- Post the proposed new time for each rescheduled job

**Decision order:** Handle displaced jobs in tier order — Tier 1 customers first (they get the best reassignment options), then Tier 2, then Tier 3.

### Customer-Tier-Aware Messaging

Each displaced customer gets a notification calibrated to their tier. These messages are posted to the customer group via `[POST_TO_CUSTOMER: ...]` directives (or sent as sequential messages in the customer group). The tone and content must differ by tier:

**Tier 1 (VIP) — Personal apology + priority action:**
```
Hi Mrs. Garcia, this is Shamrock Plumbing. I'm sorry about this — we had an emergency come in that pulled Marcus away. I've got Tyler heading to you at 3:00pm today for your faucet repair. Same great work, just a different tech. I apologize for the shuffle, and I appreciate your patience. You've been with us for years and I don't take that for granted.
```

**Tier 2 (Regular) — Warm + solution-oriented:**
```
Hi Mr. Ramirez, this is Shamrock Plumbing. We had an emergency come up and need to adjust your appointment today. I've got you rescheduled for tomorrow at 10:00am with Tyler. I'm sorry for the change — we'll make sure it gets taken care of.
```

**Tier 3 (New) — Professional + brief:**
```
Hi Mr. Johnson, this is Shamrock Plumbing. We need to reschedule your drain clearing due to an emergency. I have tomorrow at 1:00pm available with Tyler. Would that work for you?
```

Key rules:
- Tier 1 messages are longer, more personal, reference the relationship
- Tier 2 messages acknowledge the inconvenience, offer the solution
- Tier 3 messages are professional, direct, offer the next available slot
- NONE of the messages share details about the emergency or the other customer
- All messages come AFTER tech confirmation (per migration 05's gate)

### Schedule Rebuild

After all displaced jobs are handled, the agent posts the full updated schedule to the ops group:

```
📅 SCHEDULE UPDATE (post-emergency)

Marcus:
  ✅ NOW: Emergency — 742 Lakeside Dr, Saratoga Springs — active ceiling leak
  Est. completion: 1:30pm
  ◻️ 2:00pm: OPEN (Garcia reassigned to Tyler)
  ◻️ 3:30pm: OPEN (Webber rescheduled to Thursday)

Tyler:
  🔧 11:00am: Current job — Ramirez toilet replacement (continuing)
  ➕ 3:00pm: Garcia faucet repair (reassigned from Marcus)

Jake:
  🔧 12:00pm: Thorpe water softener service (unchanged)

Danny:
  🔧 10:00am: Park faucet install (unchanged)

FLEX STATUS:
  Morning buffer: CONSUMED (emergency dispatch)
  Afternoon buffer: Available

DISPLACED SUMMARY:
  ✅ Garcia faucet repair → reassigned to Tyler at 3:00pm (same day)
  📅 Johnson drain clearing → rescheduled to tomorrow 1:00pm (Tyler)
  📅 Webber consultation → rescheduled to Thursday 1:00pm (Marcus)

All affected customers have been notified.
```

### Blake Briefing

After everything is handled, the agent posts a concise briefing to the ops group:

```
📋 BLAKE BRIEFING

WHAT HAPPENED:
Active ceiling leak emergency at 742 Lakeside Dr, Saratoga Springs.
Customer: [name], [tier status].

WHAT I DID:
• Dispatched Marcus (senior, 12 min away, was on bumpable Tier 3 job)
• Marcus confirmed en route at [time]
• Reassigned Garcia (Tier 1) to Tyler at 3:00pm — same-day preserved
• Rescheduled Johnson (Tier 3) to tomorrow 1:00pm with Tyler
• Rescheduled Webber (new) consultation to Thursday 1:00pm with Marcus
• Morning flex buffer consumed

WHY:
• Marcus chosen over Jake because Jake was serving Patterson (Tier 1) and Marcus was serving Johnson (Tier 3)
• Tyler not considered — mid-install on Chen water heater (Tier 1, non-interruptible)
• Danny not eligible — junior tech cannot handle emergencies alone
• Garcia preserved same-day because she's a 5-year customer with 3 referrals

RECOMMENDATION:
Tomorrow's schedule should include a morning flex buffer to replace the one consumed today.

No action needed from you unless you want to override anything.
```

### State Updates

After the cascade is complete, update state:
- Each reassigned job: update techId and time
- Each rescheduled job: update status to "rescheduled", store the new date/time
- Tech availability: update after reassignments
- Flex buffer: mark consumed slot

### Prompt Updates

Add to the system prompt:
1. Displaced job handling logic (reassign vs. reschedule decision tree)
2. Customer notification templates by tier (with tone guidance, not rigid templates)
3. Schedule rebuild format for ops group
4. Blake briefing format
5. Instruction to handle displaced jobs in tier order (Tier 1 first)
6. Instruction to include a recommendation for tomorrow's schedule in the briefing
7. Instruction that ALL customer notifications happen AFTER tech confirmation (reinforce the gate from migration 05)

## Files to Modify

- `src/prompts/system-prompt.ts` — add cascade handling instructions, tier messaging guidance, schedule rebuild format, Blake briefing format

## Acceptance Criteria

- **Given** Marcus has been dispatched and confirmed for an emergency
  **When** the agent handles displaced jobs
  **Then** Garcia (Tier 1) is handled first, with same-day reassignment to another tech if possible

- **Given** Marcus's three remaining jobs need handling (Garcia Tier 1, Johnson Tier 3, Webber new)
  **When** the agent decides reassign vs. reschedule
  **Then** Garcia is reassigned to Tyler same-day (highest priority), while Johnson and Webber are rescheduled to future days

- **Given** Garcia's job is reassigned to Tyler at 3:00pm
  **When** the customer notification is sent to the customer group
  **Then** the message is personal, references her years with Shamrock, apologizes for the shuffle, and names the new tech and time

- **Given** Johnson's job is rescheduled to tomorrow
  **When** the customer notification is sent
  **Then** the message is professional and brief, offers the next available slot, and does not over-apologize

- **Given** all displaced jobs have been handled
  **When** the schedule rebuild is posted to the ops group
  **Then** it shows the complete updated schedule for all 4 techs with reassignments, reschedules, and flex buffer status

- **Given** the cascade is complete
  **When** the Blake briefing is posted to the ops group
  **Then** it includes: what happened, who was dispatched and why, how each displaced job was handled, which customers were notified, and a recommendation for tomorrow

- **Given** the Blake briefing is posted
  **When** it is inspected
  **Then** the reasoning references specific data: customer tier, years as customer, drive times, job bumpability — not generic statements

- **Given** no tech has an open slot to pick up Garcia's job today
  **When** the agent decides how to handle Garcia's job
  **Then** it reschedules Garcia to the earliest possible slot (not just "next week") and uses Tier 1 messaging with an extra apology for not keeping it same-day

- **Given** all customer notifications have been sent
  **When** the notifications are inspected
  **Then** none of them mention the emergency, the other customer, or any internal decision-making details

- **Given** the morning flex buffer was consumed by the emergency
  **When** the Blake briefing is posted
  **Then** it explicitly notes the buffer was consumed and recommends building one into tomorrow's schedule

- **Given** the full emergency flow runs end-to-end (intake → dispatch → confirm → cascade → rebuild → briefing)
  **When** the ops group history is reviewed
  **Then** it shows a complete decision chain: emergency alert → tech evaluation → dispatch decision → tech confirmation → displaced job decisions → schedule rebuild → Blake briefing, with no gaps
