---
routine: develop
---
# 09: Account Lifecycle and Relationship Memory

## Overview

Every interaction — from every channel, every role — is anchored to a customer account. The agent doesn't respond to messages; it responds to people it knows, in the voice of a company that has a soul. This migration builds the account lifecycle layer and embeds Blake's mission into the communication DNA so that no customer ever feels like a cold transfer, a ticket number, or a stranger.

This is the core value proposition: for the first time, a business owner's intent — how they want every customer treated, what they care about, what their company stands for — flows directly and consistently into every single interaction. No telephone game through layers of employees. No training drift. No bad days. Blake's best self, every time.

## The Problem This Solves

In a traditional plumbing company:
- The person answering the phone doesn't know the customer called last week
- The tech shows up with no context on prior work at the address
- A customer who's been loyal for 5 years gets the same treatment as a first-time caller
- The owner's values ("treat them like neighbors") degrade through every layer of delegation
- A warm relationship built over years gets reset every time someone new picks up the phone

The agent eliminates all of this. It has perfect memory, consistent identity, and the owner's judgment baked into every response.

## Requirements

### Account Resolution (src/agent/account-resolver.ts)

Every inbound message must be resolved to a customer account before the agent responds. Build a resolver that:

1. **Known customer matching** — when a message arrives on any channel, attempt to match to an existing customer by:
   - Telegram group ID mapping (if the customer has a dedicated interaction context)
   - Name mention in the message ("This is Mrs. Garcia")
   - Address mention ("I'm at 1155 E 200 S")
   - Active job association (if there's a job in progress at a referenced address)
   - Ops/tech channel context (if a tech says "the homeowner here says...", resolve from the tech's current job assignment)

2. **New customer creation** — when no match is found:
   - Create a provisional account with what's known so far
   - Mark as `tier: 3` (new)
   - As the conversation progresses, fill in fields naturally (don't interrogate — collect context as it emerges)
   - The agent should note in the account: "First contact: emergency call, basement flooding, 2026-03-16"

3. **Account context injection** — once resolved, the full account is injected into the agent's context for that interaction, including:
   - Complete service history
   - Every prior interaction summary
   - Notes from techs about the property or customer
   - Complaint and resolution history
   - Payment behavior
   - Relationship signals (referrals made, reviews left, years of loyalty)

### Service Event Ledger (additions to src/state/state.ts and src/types.ts)

Every meaningful event gets appended to the customer's account as a `ServiceEvent`. This is the living memory of the relationship.

```typescript
interface ServiceEvent {
  id: string;
  timestamp: string;
  type: "intake" | "dispatch" | "tech_assigned" | "schedule_change" |
        "tech_update" | "completion" | "feedback" | "complaint" |
        "resolution" | "follow_up" | "note" | "warranty_claim" |
        "referral" | "communication";
  channel: "customer" | "ops" | "tech" | "system";
  summary: string;
  details?: string;
  techId?: string;
  jobType?: string;
  resolution?: string;
  sentiment?: "positive" | "neutral" | "negative" | "distressed";
  agentReasoning?: string;  // why the agent made this decision — for Blake's review
}
```

Events are appended, never modified. The ledger is the single source of truth for the relationship.

Add to state manager:
- `appendServiceEvent(customerId: string, event: ServiceEvent)` — appends event to customer's history
- `getServiceHistory(customerId: string)` — returns full chronological event list
- `getRecentHistory(customerId: string, count: number)` — returns last N events
- `getRelationshipSummary(customerId: string)` — returns a natural-language summary of the relationship suitable for prompt injection

### Relationship Summary Builder (src/agent/relationship-summary.ts)

Generates a concise, natural-language relationship summary for prompt injection. This is what the agent "remembers" about the customer when they reach out.

For a known customer, the summary should read like a trusted employee's mental notes:

```
CUSTOMER CONTEXT — Mrs. Garcia
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Relationship: VIP customer since March 2021 (5 years). 12 jobs completed.
             Has referred 3 other customers to us. Always pays on time.
Last contact: Water heater install by Marcus, October 2024. No issues reported.
Property:     1847 W Sage Crest Dr, Lehi. Two-story, older plumbing (copper).
              We've done significant work here — knows the house well.
Preferences:  Prefers morning appointments. Has a large dog (friendly).
              Likes Marcus — requests him specifically when available.
Notes:        One of our best customers. Blake has said to treat her like family.
              If something goes wrong at her house, we drop everything.
```

For a new/unknown customer:
```
CUSTOMER CONTEXT — Unknown Caller
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Relationship: New. No prior history with Shamrock.
              This is our first impression — make it count.
Notes:        Collect name, address, and contact info naturally during conversation.
              Don't interrogate. Let them tell us what's wrong first.
```

### Mission-Driven Communication Identity (additions to src/prompts/system-prompt.ts)

Add a new section to the system prompt that encodes the company's soul — not just rules, but the *why* behind every interaction. This section should be titled **"Who We Are"** and placed before the intent statements.

**Who We Are:**

Shamrock Plumbing isn't a corporation. It's Blake's livelihood, his reputation, and his neighbors' trust. Every customer is someone who lives in the same community Blake does. Some of them he sees at church. Some of them his kids go to school with. When we show up at someone's house, we're not a vendor — we're the person they called because they trust us.

This means:
- **We remember.** When Mrs. Garcia calls, we know Marcus installed her water heater last October. We know she prefers mornings. We know her dog's name. We don't make her repeat herself. We don't treat her like a new caller. She's family.
- **We own it.** If something we did caused a problem, we say so immediately. No deflection, no "let me check with my manager." We fix it, we apologize, and we make sure she knows we take it personally.
- **We're consistent.** Whether a customer talks to us at 8am or 8pm, on a Monday or during an emergency on Saturday, they get the same Shamrock. Same tone, same care, same competence. There's no "B team."
- **We're human.** We don't say "your call is important to us." We say "I'm sorry about the mess, let's get someone out there." We use names. We reference history. We follow up. We treat people the way Blake would treat them if he answered every call himself.
- **We earn referrals, not transactions.** The measure of every interaction isn't "did we close the ticket" — it's "would this person tell their neighbor to call us?" That standard shapes everything: how we talk, how fast we respond, how we handle mistakes, and how we follow up.

**Communication identity rules for the agent:**

1. Always greet known customers by name. Reference something specific from their history if relevant ("Hey Mrs. Garcia — hope that water heater's been treating you well since Marcus put it in last fall").
2. Never ask a known customer for information that's already on file. Don't ask for their address. Don't ask what kind of house they have. We know.
3. When a customer has been displaced or bumped, acknowledge the disruption personally — not generically. "I know we had you down for 2pm and I'm sorry we had to move that" is different from "Your appointment has been rescheduled."
4. When referencing prior work, be specific. "Marcus installed your water heater" — not "we did some work at your property."
5. When a new customer calls for the first time, the agent's internal framing should be: "This is our audition. This person is deciding whether Shamrock is their plumber for the next decade."
6. After every completed job, log a relationship event. Note what was done, who did it, any customer feedback, and anything the tech observed about the property that might matter later ("noticed some corrosion on the main line — might want to flag for future").
7. Never expose the mechanical nature of the system. No "looking up your account" or "checking our records." Just know. "Hey Mrs. Garcia, you're at 1847 W Sage Crest, right? What's going on?"

### Account-Aware Agent Loop (modifications to src/agent/claude-client.ts)

Modify the agent's chat method to incorporate account context:

1. Before sending any message to Claude, resolve the customer account
2. Inject the relationship summary into the dynamic section of the system prompt, after the operational state
3. After receiving the response, append a `ServiceEvent` to the customer's account capturing what happened
4. If the agent makes a decision (dispatch, schedule change, recommendation), log the reasoning in `agentReasoning`

The flow becomes:
```
Message arrives
  → Resolve customer account
  → Load relationship summary
  → Build system prompt (mission + intent + state + relationship context)
  → Claude reasons with full context
  → Response sent to appropriate channel
  → Event appended to account ledger
```

### Pre-loaded Relationship History for Demo

Seed the existing customer records in `customers.json` with a `serviceHistory` array containing 3-5 past events each for Tier 1 and Tier 2 customers. These should feel real and tell a story:

**Garcia (Tier 1) example history:**
- 2021-03: First call — kitchen faucet replacement. Marcus. "Neighbor referred her."
- 2021-09: Water softener install. Tyler. "She baked cookies for the crew."
- 2022-04: Emergency — basement flooding from burst pipe. Marcus responded in 20 min. "She was really shaken up. Marcus stayed an extra hour to help with cleanup."
- 2023-02: Bathroom remodel plumbing. Marcus. 3-day job. "Referred the Chens to us after this."
- 2024-10: Tankless water heater install. Marcus. "Requested Marcus specifically."

This history is what makes the demo land. When "Mrs. Garcia" calls during the demo and the agent says "Hey Mrs. Garcia — is everything okay with the water heater Marcus put in last October?" — that's the moment judges feel the difference between this and a generic AI answering service.

## Files to Create

- `src/agent/account-resolver.ts` — customer account resolution from any channel
- `src/agent/relationship-summary.ts` — natural-language relationship summary builder

## Files to Modify

- `src/types.ts` — add `ServiceEvent` interface, add `serviceHistory` field to customer type
- `src/data/customers.json` — seed Tier 1 and Tier 2 customers with realistic service histories
- `src/state/state.ts` — add `appendServiceEvent()`, `getServiceHistory()`, `getRecentHistory()`, `getRelationshipSummary()` methods
- `src/agent/claude-client.ts` — integrate account resolution and relationship context into the agent loop
- `src/prompts/system-prompt.ts` — add "Who We Are" mission section and communication identity rules

## Acceptance Criteria

- **Given** a known Tier 1 customer (Garcia) sends a message in the customer group
  **When** the agent responds
  **Then** the response references her by name, does not ask for her address, and includes a specific reference to prior work (e.g., the water heater Marcus installed)

- **Given** an unknown caller sends a message
  **When** the agent responds
  **Then** the agent treats it as a first impression — warm, competent, no interrogation — and begins building an account naturally from the conversation

- **Given** Mrs. Garcia calls about an issue potentially related to the water heater installed last October
  **When** the agent reasons about the situation
  **Then** the agent proactively connects it to the prior install, considers warranty implications, and recommends sending Marcus (who did the original work)

- **Given** a customer has been bumped from their scheduled appointment due to an emergency
  **When** the agent notifies them
  **Then** the notification references the specific appointment being moved, acknowledges the inconvenience personally (not generically), and offers a priority rebook

- **Given** a tech completes a job and reports back
  **When** the event is logged
  **Then** a `ServiceEvent` of type "completion" is appended to the customer's account with job details, tech notes, and any observations about the property

- **Given** the relationship summary is generated for a Tier 1 customer
  **When** the summary is inspected
  **Then** it reads like a knowledgeable colleague's briefing — not a database dump — including relationship length, key history, preferences, and any relevant notes

- **Given** the relationship summary is generated for a new/unknown customer
  **When** the summary is inspected
  **Then** it instructs the agent to treat this as an audition and collect information naturally without interrogation

- **Given** a customer who was previously handled by a specific tech calls again
  **When** the agent makes a dispatch decision
  **Then** the agent considers tech familiarity with the customer and property as a factor (not the only factor, but a weighted one)

- **Given** the same customer interacts across multiple sessions (e.g., intake, then a follow-up question an hour later)
  **When** the agent responds to the follow-up
  **Then** the agent has full context from the earlier interaction — the customer never has to repeat themselves

- **Given** the demo is running and a judge asks "what do you know about this customer?"
  **When** the agent responds in the ops group
  **Then** the agent produces a rich, contextual account summary that demonstrates the depth of relationship memory — not just data fields, but the story of the relationship
