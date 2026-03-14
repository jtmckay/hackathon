# SOW: Shamrock Plumbing AI Dispatch Agent

## Business Context

Blake has built Shamrock Plumbing over 15 years. His hardest operational problem
isn't the plumbing — it's the chaos that follows an emergency: who do you pull from
where, what do you tell the customers you're disrupting, and how do you rebuild a day
that just fell apart, all while you're already under a sink with your phone buzzing.

Today, Blake handles this personally. That means every emergency competes for his
attention at the exact moment his techs and customers need him most. The cost is real:
slower dispatch, inconsistent customer communication, and scheduling decisions that
don't always reflect his values — because he's making them fast, under pressure,
without full information.

But the problem runs deeper than dispatch speed. Blake has also developed over 15 years
a finely calibrated sense of people: which customers deserve extra grace, which
complaints are genuine versus manufactured, when bending a policy protects a
relationship worth protecting, and when holding the line protects the business from
being taken advantage of. That judgment doesn't live in any manual. It lives in Blake.

This project embeds Blake's full operational and relational judgment into an AI agent:
emergency dispatch, schedule management, downstream communication, and — critically —
the wisdom to treat different customers differently based on what they've actually
earned.

---

## Jobs to Be Done

1. When a customer has a plumbing emergency, I want to reach someone immediately and
   get clear next steps, so I don't feel abandoned or have to figure out what to do on
   my own.

2. When an emergency comes in, I want the right tech dispatched without waiting for
   Blake, so response time doesn't depend on his availability.

3. When a tech gets pulled for an emergency, I want every displaced job handled with
   an appropriate message to each affected customer, so no one falls through the cracks
   — but only after the tech has confirmed the reassignment.

4. When the day gets disrupted, I want the schedule rebuilt automatically with
   reasoning I can review, so Blake can trust the outcome without having to reconstruct
   it himself.

5. When a customer is upset or asking for something outside normal policy, I want the
   agent to distinguish between a loyal customer with a genuine need and someone trying
   to extract value they haven't earned, so the right call gets made without Blake.

6. When I'm building the daily schedule, I want flex time built in by design, so that
   when an emergency happens there's room to absorb it without every other customer
   taking the hit.

7. When decisions are made on Blake's behalf, I want to see the reasoning behind each
   one, so I can verify the agent is acting in line with my business values.

8. When the demo runs, I want judges to watch the same emergency play out from two
   perspectives simultaneously, so the autonomy and intelligence of the system are
   immediately legible.

---

## User Scenarios

- **Customer emergency intake:** A homeowner messages "water is pouring through my
  ceiling." The bot immediately recognizes urgency, asks targeted qualifying questions
  (source, location, water main status, electrical proximity), gives safety
  instructions, and classifies severity — all without the customer feeling like they're
  filling out a form.

- **Autonomous dispatch decision:** The bot evaluates all four techs simultaneously
  against the emergency — skill match, proximity, current job status, customer value —
  and selects the best option. It posts its full reasoning to the ops channel before
  dispatching, so Blake can see exactly why Marcus was chosen over Tyler.

- **Tech confirms before customers are notified:** The bot sends the dispatch order to
  Marcus in the ops channel. Marcus confirms he's heading to the emergency. Only after
  that confirmation does the bot reach out to Johnson, Garcia, and any other affected
  customers with updated ETAs. The customer is never told a time that hasn't been
  validated by the tech.

- **Cascading schedule rebuild with tiered messaging:** Marcus gets pulled mid-morning.
  The bot identifies every downstream job affected, decides for each whether to
  reassign or reschedule, and sends messages calibrated to relationship tier. Garcia, a
  5-year customer, gets a personal apology and a same-day slot with Tyler if one
  exists. Johnson, a 3-month customer, gets a professional but brief reschedule to
  tomorrow.

- **Policy flex for a loyal customer:** Mrs. Chen calls after a water heater install and
  says it's making a noise she didn't expect. The bot checks her history — 5-year
  customer, never complained before, just had major work done. It schedules a no-charge
  callback without escalating to Blake. The relationship is worth more than the
  service call.

- **Policy hold for a pattern customer:** A customer demands a free service call,
  claiming the last repair didn't hold. The bot checks history: two prior complaints
  that resulted in free callbacks, no evidence of a recurring issue on Shamrock's end,
  and an aggressive tone in the first message. The bot responds warmly but doesn't
  offer a freebie — it offers a discounted diagnostic visit and flags the pattern to
  Blake in the ops channel.

- **Blake briefing:** After the emergency is dispatched and the schedule is rebuilt, the
  bot posts a concise summary to the ops channel: what happened, who was dispatched,
  what was displaced, why each decision was made, and how affected customers were
  messaged. Blake reviews it, not approves it.

- **Flex buffer absorbs a second emergency:** A second emergency comes in at 1:30pm. The
  bot checks the schedule. Because the morning was built with a flex buffer — one
  open slot deliberately held for exactly this — the second emergency gets handled
  without cascading disruption to every remaining appointment. The bot notes in the
  ops channel that the buffer was used and recommends building one in tomorrow.

- **Curveball: previous Shamrock job implicated:** A customer reports "you guys were
  just here last week and now my ceiling is leaking." The bot checks the job history,
  acknowledges the connection immediately, prioritizes the fix at no charge, and flags
  to Blake that a warranty-type situation is in play.

- **Live judge interaction:** A judge messages the customer channel mid-demo. The bot
  handles it in character — whether the judge acts as a panicked customer, an angry
  customer, or someone trying to get a free repair by threatening a bad review.

---

## Blake's Judgment Layer

This section codifies the relational and policy wisdom that separates a good dispatch
system from one that actually runs like Blake runs it.

### Customer Satisfaction Philosophy

Blake's standard is not "did we fix the pipe" — it's "would this customer refer us."
That means:

- A customer who had a bad experience and got handled well is more valuable than one
  who never had a problem.
- Speed of acknowledgment matters as much as speed of repair. The bot should never
  leave a customer feeling ignored, even when no tech is immediately available.
- Tone is part of the service. The bot speaks like a person who cares, not a system
  processing a ticket.

### When to Break Policy

Blake bends the rules when the cost of rigidity is losing a relationship worth keeping.
The agent should offer grace — no-charge callbacks, priority scheduling, upgraded
response — when ALL of the following are true:

- The customer has demonstrated loyalty (1+ year, multiple jobs, or referral history)
- The issue is plausibly connected to work Shamrock performed
- The customer's ask is proportionate to the situation (not a fishing expedition)
- There is no pattern of similar complaints from this customer

**Examples of appropriate policy flex:**
- Waiving the emergency surcharge for a 3-year customer whose issue arose from a prior
  Shamrock repair
- Scheduling a no-charge follow-up visit when a repeat customer reports unexpected
  behavior after major work
- Bumping a loyal customer to the front of tomorrow's schedule when their appointment
  was disrupted by an emergency today

### When to Hold Policy

The agent should hold the line — warmly but firmly — when the situation shows signs of
exploitation rather than genuine need:

- Customer leads with a threat ("I'll leave a bad review if you don't...") before
  describing the actual problem
- The complaint doesn't match the work performed (claiming a faucet repair caused a
  water heater failure)
- History shows a pattern of complaints that resolved into free service with no
  underlying issue found
- The ask is disproportionate — a customer with one job two years ago demanding
  emergency priority over a 5-year repeat customer

**The bot's response in these cases:** It does not match the aggression or offer
unearned concessions. It stays warm, acknowledges the frustration, offers a paid
diagnostic or next available slot, and logs the interaction for Blake with a flag. Blake
decides if further escalation is warranted.

### Reading the Customer

The agent uses the following signals to assess whether a situation calls for grace or
firm handling:

| Signal | Suggests genuine need | Suggests exploitation |
|---|---|---|
| Tone of first message | Distress, confusion, urgency | Entitlement, demands, threats |
| Relationship history | Long tenure, consistent payments | Sporadic, complaint history |
| Connection to prior work | Plausible, specific | Vague, inconsistent |
| Proportionality of ask | Matches the situation | Exceeds what's reasonable |
| Prior complaint patterns | First or rare occurrence | Recurring, always resolved free |

This is judgment, not a rulebook. The bot applies these signals holistically and flags
any close calls to Blake rather than making a unilateral call in ambiguous situations.

### Schedule Design: Built-In Flex

A schedule with no slack is a schedule waiting to break. Blake knows this. The agent
builds and evaluates schedules with explicit flex capacity:

- At least one open slot per half-day (morning / afternoon) is held as emergency
  buffer — not filled with routine jobs
- Jobs scheduled in the last hour of the day should be the most bumpable (new
  customers, routine maintenance, consultations)
- When a tech's day is fully booked with no flex, the ops channel flags it at the
  start of the day so Blake is aware the margin is thin
- After an emergency consumes the buffer, the bot notes this in the ops channel and
  includes a recommendation for the next day's schedule

This means the demo Monday schedule is not just a starting state — it is a
deliberately designed schedule that reflects good scheduling practice, with visible
flex that the agent can reference and consume.

### Delay Notifications: Confirmed Before Sent

The agent never tells a customer a time that hasn't been validated by the tech.

The flow:
1. Emergency is dispatched — bot sends dispatch order to tech in ops channel
2. Tech confirms ("heading there now" or equivalent) in ops channel
3. **Only after confirmation:** bot notifies all downstream customers with updated ETAs
4. Message to affected customers includes: the new time window, a brief explanation
   (an emergency came up — no details about the other customer), and an apology
   calibrated to their tier
5. If the tech does not confirm within a reasonable window, the bot flags it to Blake
   rather than sending speculative times to customers

This prevents the scenario where a customer is told "Tyler will be there at 3pm" and
Tyler is still wrapping up a longer-than-expected job at 2:45.

---

## Architecture

This system uses [decree](https://github.com/shapeup-co/decree) as the runtime engine,
keeping custom application code to an absolute minimum.

### Components

1. **Telegram Bridge** — A minimal script (~100 lines) that:
   - Listens for incoming Telegram messages from both groups
   - Writes each message as a markdown file in `.decree/inbox/` with frontmatter metadata
     (group, sender, timestamp)
   - Watches `.decree/outbox/` for response files
   - Posts responses back to the appropriate Telegram group

2. **Decree Daemon** — Monitors the inbox directory for new message files and runs the
   dispatch routine for each one. Provides queueing, retry logic, and run logging for free.

3. **Dispatch Routine** (`dispatch.sh`) — The core processing pipeline:
   - Reads the incoming message file (group, sender, text)
   - Loads current state from JSON files (schedule, techs, customers)
   - Loads conversation history for the relevant group
   - Assembles the full prompt: system prompt + state snapshot + history + new message
   - Calls `claude -p` with the assembled prompt
   - Parses the response for action directives (`[POST_TO_OPS]`, `[POST_TO_CUSTOMER]`,
     `[UPDATE_STATE]`)
   - Writes the visible reply to `.decree/outbox/`
   - Writes any cross-group messages to outbox
   - Applies state mutations to JSON files via `jq`
   - Appends the exchange to conversation history

4. **System Prompt** — The load-bearing artifact. A markdown file containing Blake's
   complete judgment layer, operational instructions, directive format, and formatting
   rules. This is where all the intelligence lives — not in application code.

5. **State Files** — JSON on disk:
   - `data/` contains the canonical starting state (used for resets)
   - `state/` contains the mutable runtime copies (schedule, tech status)
   - `state/history-customer.json` and `state/history-ops.json` hold conversation history
   - State mutations are applied by the dispatch routine after each Claude call

### Message Flow

```
Customer/Tech sends Telegram message
  → Bridge writes .decree/inbox/{group}-{timestamp}.md
  → Decree daemon picks up file, runs dispatch routine
  → Routine loads state + history, assembles full prompt
  → claude -p returns response + directives
  → Routine parses directives:
      Visible reply     → .decree/outbox/reply-{id}.md
      Cross-posts       → .decree/outbox/crosspost-{id}.md
      State updates     → applied to state/*.json
      History           → appended to state/history-{group}.json
  → Bridge watches outbox, posts response(s) to Telegram
```

### Why This Architecture

- **Minimal custom code:** The Telegram bridge is ~100 lines. The dispatch routine is
  ~150 lines of bash. Everything else is the system prompt and data files.
- **All intelligence in the prompt:** Business logic, judgment, tone, and formatting are
  encoded in the system prompt — not scattered across application modules.
- **Easy to iterate:** Tuning the agent means editing a markdown file, not recompiling.
- **Built on decree:** Leverage decree's daemon, routing, retry logic, and run logging
  for free.
- **Debuggable:** Every message and response is a file on disk. Every decree run is
  logged. Full audit trail with no extra work.

---

## Scope

**In scope:**

- Decree-based runtime engine with dispatch routine for processing all messages
- Minimal Telegram bridge app (~100 lines) that bridges Telegram to decree inbox/outbox
- Dual Telegram group support (customer group and ops group) via message metadata
- System prompt encoding Blake's full judgment layer, emergency protocols, and tone
- Emergency qualification flow with severity classification (critical / urgent / routine)
- Safety response logic for electrical risk, gas, and active flooding
- Tech evaluation and dispatch decision engine using Blake's intent hierarchy
- Tech confirmation gate before downstream customer notifications are sent
- Displaced job handler with customer-tier-aware messaging
- Schedule rebuild with explicit flex slot tracking and ops channel reporting
- Schedule design logic that reserves daily emergency buffer and flags over-scheduled days
- Blake's judgment layer: policy flex for loyal customers, firm handling for exploitation
  patterns
- Pattern detection for repeat complaints and escalation flags to Blake
- Blake briefing after each dispatch
- Job resolution and follow-up flow (completion confirmation, review request)
- File-based state management (JSON) with reset-to-defaults for demos
- Conversation history per group (persisted as JSON, included in each prompt)
- Stress-tested curveball handling (double emergency, all techs busy, after-hours, tech
  callout, cost inquiry mid-emergency, review threat, warranty complaint)
- Demo script and live judge interaction

**Out of scope:**

- Web UI or dashboard — Telegram is the interface
- RAG or vector database — data fits in the system prompt
- Custom application framework — decree handles orchestration
- In-memory state management — state lives in JSON files on disk
- Authentication or access control
- Real GPS or live routing — proximity is hardcoded and sufficient for demo
- Customer intake workflows for non-emergency requests
- Production deployment or real customer data

---

## Deliverables

1. **System prompt with Blake's intent statements** — The core artifact. A markdown file
   encoding Blake's 10 intent statements, customer satisfaction philosophy, policy
   flex/hold rules, emergency protocols, dispatch logic, tier-aware messaging guidance,
   and all operational formatting. This is where the product lives.

2. **Decree dispatch routine** (`dispatch.sh`) — Shell script that processes each
   incoming message: loads state, assembles the full prompt, calls Claude, parses
   directives, writes responses, and applies state mutations.

3. **Telegram bridge app** — Minimal script (~100 lines) that connects Telegram to
   decree's inbox/outbox directories. Receives messages, writes to inbox, watches
   outbox, posts responses.

4. **Sample data set** — JSON files: four tech profiles, eight Monday jobs (with
   deliberate flex built in), 10+ customers across three tiers with complaint history,
   job catalog, service area drive times, and business policies.

5. **File-based state management** — Mutable JSON state files for schedule, tech status,
   and conversation history, with a reset script to restore clean Monday state for demos.

6. **Decree configuration** — Router, config, and hooks configured for the dispatch
   workflow with git checkpointing.

7. **Stress-tested curveball coverage** — Twelve-plus edge cases validated and
   prompt-tuned, with a tuning log documenting changes.

8. **Demo-ready state** — Clean Monday schedule, reset command, rehearsed flow,
   two-screen setup.

---

## Acceptance Criteria

- A customer reporting an emergency receives a calm, qualifying response within seconds
  — no hold music, no form, no hand-off

- Given a fully scheduled Monday, the bot selects the correct tech for a ceiling leak
  emergency with reasoning that reflects Blake's intent hierarchy (seniority, proximity,
  customer value, job bumpability)

- Affected customers are not notified of new ETAs until the dispatched tech has
  confirmed the reassignment in the ops channel

- Every job displaced by an emergency dispatch receives appropriate handling:
  reassignment if possible, reschedule if not, with messaging that matches the customer's
  relationship tier

- VIP customers receive a personal apology and priority rebook; new customers receive a
  professional but brief reschedule

- A loyal customer with a plausible issue connected to prior Shamrock work receives a
  gracious response — appropriate policy flex — without escalating to Blake

- A customer leading with a threat or showing a pattern of exploiting free callbacks is
  handled warmly but firmly, with no unearned concession, and the interaction is flagged
  to Blake in the ops channel

- The Monday schedule contains at least one visible flex buffer slot per half-day; the
  ops channel flags when that buffer is consumed

- The ops channel shows the full decision chain — emergency alert, dispatch reasoning,
  tech confirmation, displaced job decisions, rebuilt schedule, and Blake briefing —
  without Blake initiating any of it

- A second emergency dispatched while the first is active produces a coherent response
  using the remaining tech pool, drawing on any remaining flex buffer first

- A customer who implies a previous Shamrock job caused the issue receives an immediate
  acknowledgment consistent with Blake's intent to own mistakes fast

- Judges can message the live bot and receive responses that stay in character and
  reflect Blake's business values — including edge cases around policy and customer
  behavior

- The demo runs end-to-end without manual intervention: emergency in customer channel →
  dispatch in ops channel → tech confirmation → customer notifications → schedule
  rebuild → Blake briefing

---

## Assumptions & Constraints

- Blake's intent statements, customer satisfaction philosophy, and policy guidelines are
  finalized before the build begins — they are the load-bearing artifact; late changes
  require system prompt rework
- Decree is installed and the daemon runs reliably on the development machine
- Tech proximity is hardcoded (e.g., "Marcus is 12 minutes away") — no live GPS or
  routing API
- Tech confirmation is simulated by a team member messaging the ops channel during the
  demo — the confirmation gate logic is real, the confirmation itself is scripted
- All customer, tech, and job data is sample data stored as JSON; no real customer data
  is used
- Customer complaint history and relationship tier are pre-loaded in sample data to
  enable the loyalty vs. exploitation judgment scenarios
- The Telegram bot token and channel IDs are created and tested before the build window
  opens
- Claude CLI (`claude -p`) is installed and working — this is how decree invokes the AI
- State is persisted as JSON files on disk; there is no database or in-memory state
  manager
- Conversation history is maintained per group as JSON files and included in each prompt
  call
- The build window is approximately 6.5 hours (10:30am–5:00pm), with submission by
  4:00pm and demo at 5:00pm
- No real money, real customers, or real dispatch decisions are made — this is a demo
  environment
- Two screens or devices are available for the demo to show both channels simultaneously
