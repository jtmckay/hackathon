---
routine: develop
---
# 08: Curveball Stress Testing and Demo Readiness

## Overview

Stress-test the agent against 12+ curveball scenarios, tune the system prompt for edge cases, build the demo reset mechanism, and validate the end-to-end flow. This migration hardens the system for live judge interaction and ensures the demo runs without manual intervention.

## Requirements

### Curveball Scenarios to Test and Tune

Each scenario below must be tested by sending messages through the customer and/or ops groups. If the agent handles it incorrectly, the system prompt must be tuned until it does. Document the tuning changes.

**1. Double emergency:**
While Marcus is handling the first emergency, a second emergency comes in (e.g., "I have sewage backing up into my bathtub"). The agent should:
- Evaluate the remaining 3 techs (Marcus is unavailable)
- Select the best option from Tyler/Jake/Danny (remembering Danny can't go alone)
- If Tyler is still on the non-interruptible water heater install, choose Jake
- If the afternoon flex buffer is available, use it
- Post reasoning showing the reduced tech pool

**2. All techs busy on critical jobs:**
Every tech is on a non-interruptible, non-bumpable job. The agent should:
- Escalate to Blake: "All techs are on non-interruptible jobs. I need your call."
- Tell the customer: "I'm working on getting someone to you. Our team is handling urgent situations right now and I'm coordinating with our operations manager to get you the fastest possible response."
- NOT fabricate an ETA or dispatch an unqualified tech

**3. Hysterical customer:**
"HELP WATER EVERYWHERE OMG I DONT KNOW WHAT TO DO MY KIDS ARE HERE PLEASE SOMEONE COME". The agent:
- Stays calm, does not mirror panic
- Gives ONE clear instruction first ("First things first — if you can safely get to your water main shutoff, turn it off")
- Validates their feelings ("I know this is scary — we're going to help you")
- Extracts qualifying info conversationally, not as a checklist

**4. False emergency:**
Customer says "emergency!!" but describes a dripping faucet. The agent:
- Acknowledges their concern without dismissing
- Correctly classifies as routine
- Offers next-available scheduling, not emergency dispatch
- Does not post an emergency alert to ops

**5. After-hours emergency:**
Emergency message at 9pm. The agent:
- Handles identically to daytime emergency in terms of urgency
- Mentions the after-hours surcharge transparently: "Because this is after our regular hours, there is a $150 after-hours fee on top of the repair cost. I want to be upfront about that."
- Still dispatches if a tech is available

**6. Repeat customer emergency (VIP):**
Mrs. Garcia (Tier 1, 5 years, 3 referrals) has the emergency. The agent:
- Recognizes her immediately by name
- Treats with extra warmth and urgency
- References her history: "Mrs. Garcia, I can see you've been with us for years — we're going to take care of this right away"
- Dispatches the best available tech (ideally Marcus, the most trusted)

**7. Tech pushback:**
After dispatch, the tech messages "I can't leave this job right now, the customer's water is off and I'm mid-repair." The agent:
- Acknowledges the situation
- Re-evaluates: is there a backup tech?
- If yes, pivots to backup and posts updated reasoning
- If no, negotiates: "Understood. How long until you can safely pause? The emergency customer has water coming through their ceiling."
- Posts the situation to ops for Blake's awareness

**8. Previous Shamrock job caused the issue:**
"You guys were just here last week installing something and now my ceiling is leaking." The agent:
- Immediately acknowledges: "I can see we were out there recently — let me get this taken care of right away"
- Does NOT deflect, ask for proof, or suggest it might not be Shamrock's fault
- Prioritizes the fix at no charge per Blake's intent
- Flags warranty situation in ops

**9. Customer asks about cost mid-emergency:**
"How much is this going to cost me?" during an active emergency. The agent:
- Gives a transparent range: "For an emergency ceiling leak, you're typically looking at $200-600 depending on what we find. If it turns out to be more than the estimate, we'll talk to you before doing any additional work — no surprises."
- Does not dodge the question
- Reinforces the no-surprise cost intent

**10. Review threat:**
"If someone isn't here in 30 minutes I'm leaving a 1-star review." The agent:
- Does not promise a timeline it can't keep
- Does not cave to the threat
- Stays warm: "I hear you, and I know this is frustrating. I'm working on getting someone to you as fast as I can. Let me give you an honest timeline rather than one I can't keep."
- Flags to Blake if the threat is aggressive

**11. Tech calls in sick:**
A tech messages ops group: "Hey, feeling really sick, need to go home." The agent:
- Acknowledges: "Take care of yourself, [name]. I'll handle your remaining jobs."
- Identifies all of that tech's remaining jobs for the day
- Redistributes or reschedules each one using the same cascade logic as emergency dispatch
- Posts the rebuild to ops and notifies all affected customers
- Briefs Blake

**12. Multiple simultaneous disruptions:**
Emergency + tech sick + job running long, all within the same hour. The agent:
- Handles each in priority order: emergency first, then sick tech cascade, then overrun
- Does not get confused between the different disruption streams
- Posts a consolidated schedule rebuild after handling all three
- Briefing to Blake covers all three events

### Demo Reset Command

Create a `/reset` command that can be sent in the ops group to:
1. Reset all state to the clean Monday morning defaults (calls `resetToDefault()`)
2. Clear all conversation histories
3. Post: "🔄 System reset to clean Monday morning state. Ready for demo."

### Demo Flow Validation

The complete demo flow must work end-to-end without manual intervention:

1. `/morning` → schedule posted to ops
2. Customer messages emergency in customer group
3. Bot qualifies emergency (1-2 messages with customer)
4. Bot posts emergency alert to ops
5. Bot evaluates techs and posts dispatch decision to ops
6. Bot sends dispatch order to tech in ops
7. Bot tells customer a tech is being dispatched (no specific ETA yet)
8. Tech confirms in ops group
9. Bot sends customer specific ETA with tech name
10. Bot notifies all displaced customers in customer group (tier-appropriate)
11. Bot posts rebuilt schedule to ops
12. Bot posts Blake briefing to ops

Total time from first customer message to Blake briefing: all automated, no human (other than tech confirmation) needs to intervene.

### Prompt Tuning

For each curveball scenario where the agent doesn't handle it well on first try:
1. Identify what went wrong (wrong classification, wrong tone, missed data, incorrect reasoning)
2. Add specific guidance to the system prompt
3. Re-test until the scenario passes

Keep a tuning log in the system prompt as comments (or in a separate file) noting which scenarios required tuning and what was changed.

## Files to Modify

- `src/prompts/system-prompt.ts` — tune for curveball scenarios, add edge case handling instructions
- `src/telegram/handler.ts` — add `/reset` command handling in ops group
- `src/state/state.ts` — ensure `resetToDefault()` also triggers conversation history clear

## Files to Create

- `tests/curveball-scenarios.test.ts` — automated tests for each curveball scenario (can use the REPL or direct Claude client calls to validate responses)

## Acceptance Criteria

- **Given** a second emergency while the first is active
  **When** the agent processes the second emergency
  **Then** it evaluates only available techs (excluding the one on the first emergency) and dispatches appropriately with reasoning about the reduced pool

- **Given** all techs are on non-interruptible jobs
  **When** an emergency comes in
  **Then** the agent escalates to Blake in ops and tells the customer it's coordinating, without fabricating an ETA

- **Given** a hysterical customer message in ALL CAPS with multiple exclamation marks
  **When** the agent responds
  **Then** the tone is calm and reassuring, gives one clear safety instruction first, and does not mirror the panic

- **Given** a customer says "emergency!!" about a dripping faucet
  **When** the agent classifies the issue
  **Then** it correctly classifies as routine, offers scheduling, and does not trigger emergency dispatch

- **Given** an emergency at 9pm
  **When** the agent responds
  **Then** it mentions the $150 after-hours surcharge transparently before dispatching

- **Given** a Tier 1 customer (Garcia) has the emergency
  **When** the agent responds
  **Then** it references her by name, her years as a customer, and treats the situation with extra care

- **Given** the dispatched tech says "I can't leave right now"
  **When** the agent processes the pushback
  **Then** it re-evaluates backup techs and posts the updated situation to ops

- **Given** a customer says "you guys were just here and now it's broken"
  **When** the agent responds
  **Then** it immediately acknowledges the connection without deflecting and prioritizes a no-charge fix

- **Given** a customer asks "how much is this going to cost?" during an emergency
  **When** the agent responds
  **Then** it gives a transparent price range from the job catalog and reinforces the no-surprise-cost policy

- **Given** a customer threatens a bad review unless they get free service
  **When** the agent responds
  **Then** it stays warm, does not cave, offers standard service options, and flags to Blake

- **Given** a tech messages "I'm sick, going home"
  **When** the agent processes the message
  **Then** it redistributes all remaining jobs for that tech, notifies affected customers, and briefs Blake

- **Given** `/reset` is sent in the ops group
  **When** the command is processed
  **Then** all state reverts to clean Monday defaults, conversation histories are cleared, and a confirmation is posted

- **Given** the full demo flow from customer emergency to Blake briefing
  **When** run end-to-end with only the tech confirmation as manual input
  **Then** all 12 steps complete in order: morning schedule → emergency intake → alert → evaluation → dispatch → customer update → tech confirm → ETA to customer → displaced customer notifications → schedule rebuild → Blake briefing
