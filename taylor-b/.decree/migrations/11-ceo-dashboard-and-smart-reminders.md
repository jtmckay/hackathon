---
routine: develop
---
# 11: CEO Dashboard Channel and Smart Reminders

## Overview

Two additions that complete the role hierarchy and add a time-aware layer to the system.

First: a CEO channel — a high-level strategic feed for someone who doesn't care which tech went where but needs to know if the business is healthy, growing, and retaining customers.

Second: a reminder and scheduled notification system available to every role. Any user — customer, tech, Blake, CEO — can create reminders through natural conversation. The agent also proactively suggests reminders based on work performed, but gently, never pushy. When a reminder is created, the agent tells the user exactly when they'll next hear about it.

## Part 1: CEO Dashboard Channel

### The Role

The CEO doesn't manage day-to-day operations. They care about:
- Is the business making money?
- Are we retaining customers?
- Are we growing?
- Is the team healthy and utilized?
- Are there systemic patterns (recurring emergencies in one area, one tech getting complaints)?
- Are there strategic opportunities (new service areas, upsell patterns, hiring signals)?

The CEO channel is a digest — not a firehose. The agent posts here infrequently and with high signal.

### Channel Configuration

Add to environment:
```
TELEGRAM_CEO_GROUP_ID=
```

### What Gets Posted to the CEO Channel

**Daily summary** (posted at end of day or on `/daily` command):
```
📊 DAILY SUMMARY — Monday, March 16, 2026

REVENUE: ~$3,450 across 8 completed jobs
EMERGENCY: 1 (ceiling leak, Saratoga Springs — resolved same-day)
CUSTOMER SATISFACTION: 8/8 confirmed resolved, 1 review request pending
NEW CUSTOMERS: 1 (Webber, first consultation — strong lead)

TECH UTILIZATION:
  Marcus: 95% (pulled for emergency, handled it well)
  Tyler: 88% (picked up reassigned Garcia job)
  Jake: 75% (standard day, available capacity)
  Danny: 40% (1 job — consider loading him more tomorrow)

FLAGS:
  • Morning flex buffer consumed by emergency. Recommend rebuilding tomorrow.
  • Danny had downtime. Consider pairing him with Marcus for mentorship hours.
  • Garcia (VIP) was displaced but handled with priority. Relationship intact.
```

**Weekly summary** (posted Monday morning or on `/weekly` command):
```
📈 WEEKLY SUMMARY — Week of March 9-13, 2026

REVENUE: $14,200 (up 8% from last week)
JOBS COMPLETED: 34
EMERGENCIES: 3 (all resolved same-day)
CUSTOMER RETENTION: 100% — no lost customers
NEW CUSTOMERS: 2 (Johnson, Webber)
REFERRALS: 1 (Garcia referred a neighbor)

TRENDS:
  • Third emergency this month from Saratoga Springs area.
    Consider: proactive outreach to older homes in that neighborhood.
  • Water heater jobs up 40% month-over-month.
    Consider: seasonal promotion on water heater inspections.
  • Danny improving — callback rate dropped from 8% to 5%.
    Marcus mentorship pairing seems to be working.

TOP RISK:
  • Tyler fully booked 4 of 5 days. One overrun away from cascade.
    Consider: hiring discussion if this pattern holds another 2 weeks.
```

**Real-time flags** (posted immediately when strategic threshold crossed):
- Revenue milestone: "Crossed $50K this month — ahead of pace"
- Customer loss risk: "Two customers rescheduled twice this week. Retention risk."
- Capacity signal: "All techs fully booked 3 days running. May be leaving money on the table."
- Complaint pattern: "Second complaint about [tech] this month. Flagging for review."

### CEO Channel Voice

The agent talks to the CEO like a sharp COO giving a board-ready briefing. Concise, data-driven, always with a recommendation. No operational details — just outcomes, trends, and decisions that need attention.

### What the CEO Does NOT See

- Individual dispatch decisions or reasoning
- Customer conversations or tier-specific messaging
- Tech confirmations, pushback, or schedule details
- Policy flex decisions (unless they indicate a pattern)
- Raw schedule data

### Prompt Updates for CEO Role

Add to system prompt:
1. CEO channel awareness — what it is, who it's for, what goes there
2. CEO voice: "Talk to the CEO like a sharp operations executive. Lead with numbers. Follow with trends. Close with recommendations. No fluff, no operational details."
3. Daily and weekly summary formats
4. Real-time flag thresholds and format
5. Instruction to aggregate, not relay — the CEO channel is never a mirror of ops

## Part 2: Smart Reminders and Scheduled Notifications

### The Concept

Any user in any channel can ask for a reminder, and the agent creates it. But more importantly, the agent also *suggests* reminders based on context — work completed, manufacturer recommendations, seasonal patterns — without being pushy.

The key commitment: **when a reminder is created, the agent tells the user exactly when they'll next hear about it.** Not "we'll follow up." Not "we'll keep an eye on it." A specific date.

### Reminder Data Model

```typescript
interface Reminder {
  id: string;
  createdAt: string;
  createdBy: {
    role: "customer" | "ops" | "tech" | "ceo" | "system";
    id: string;              // customer ID, tech ID, or "blake" / "ceo"
  };
  targetChannel: "customer" | "ops" | "tech" | "ceo";
  targetId?: string;         // customer ID or tech ID if channel-specific
  triggerAt: string;         // ISO datetime for next notification
  recurrence?: {
    interval: "daily" | "weekly" | "monthly" | "yearly" | "custom";
    customDays?: number;     // for custom intervals
    endAfter?: string;       // ISO date to stop recurring, or null for indefinite
  };
  message: string;           // what to tell the user
  context: string;           // why this reminder exists (for agent reasoning)
  status: "active" | "triggered" | "snoozed" | "cancelled";
  snoozedUntil?: string;     // if snoozed, when to re-trigger
  jobId?: string;            // linked job, if applicable
  customerId?: string;       // linked customer, if applicable
}
```

### How Reminders Get Created

**1. User-initiated (any role):**

Customer: "Can you remind me when I need to replace the water filter?"
Agent: "Absolutely. Standard replacement for your model is every 6 months. I'll send you a reminder on September 16th. You'll hear from us then — no need to keep track of it yourself."

Blake: "Remind me to check Danny's callback rate next month."
Agent: "Got it. I'll flag Danny's callback rate for you on April 16th in your morning briefing."

Tech: "Remind me to bring the specialty fitting for the Garcia job Thursday."
Agent: "Noted. Thursday morning before your first job, I'll remind you about the fitting for Garcia."

CEO: "Remind me to revisit the hiring question in two weeks."
Agent: "Set. On March 28th I'll surface the hiring capacity data for you along with the latest utilization trends."

**2. Agent-suggested (post-job, contextual):**

After a water heater install, the agent messages the customer:
```
Everything's all set with your new water heater! A couple of things to know:
- Your 30-day workmanship warranty starts today
- The manufacturer recommends flushing the tank annually to keep it running well

Want me to send you a reminder next March when it's time for that annual flush?
One less thing to think about.
```

If they say yes: "Done — you'll hear from us on March 16, 2027. We'll reach out to schedule the flush."

If they say no or ignore it: move on. No follow-up nag. No "are you sure?"

**3. System-generated (automatic, based on rules):**

Some reminders are created automatically without asking:
- Warranty expiry: 3 days before the 30-day warranty ends, the agent notes it in ops: "Garcia warranty from October install expires in 3 days. No issues reported."
- Seasonal check-in: Agent creates a reminder to suggest winterization to customers in cold-weather months (October) based on their service history
- Follow-up after emergency: 48 hours after an emergency repair, agent checks in with the customer: "Hey, just wanted to make sure everything's holding up after the repair on Monday. All good?"

### The Specificity Commitment

When any reminder is created, the agent MUST tell the user the exact next trigger date. This is non-negotiable.

Bad: "We'll follow up with you about that."
Bad: "I'll keep an eye on it."
Bad: "We'll remind you when it's time."

Good: "I'll send you a reminder on September 16th."
Good: "You'll hear from us on Thursday morning, March 19th."
Good: "I've set a reminder for April 16th — I'll include the callback data in your morning briefing that day."

If the user asks "when will I hear about this?" the agent can always answer with a specific date.

### Reminder Execution

When a reminder triggers:
1. The agent posts to the appropriate channel with the reminder context
2. For customer reminders: frame it as a helpful nudge, not a sales pitch
3. For ops/CEO reminders: include it in the morning briefing or post standalone if time-sensitive
4. For tech reminders: post to their channel before their first job of the day
5. After triggering, mark as `triggered` or advance to next recurrence date

Customer-facing reminder tone:
```
Hi Mrs. Garcia — this is Shamrock Plumbing. Back in October, Marcus
installed your tankless water heater. The manufacturer recommends an
annual flush to keep it running efficiently.

Want me to get that scheduled? Marcus is available next week if you'd
like the same tech who did the install.
```

Not: "Hi, this is an automated reminder that your water heater service is due."
Not: "It's been 6 months since your last service! Book now!"

### Gentle Upsell Through Care, Not Pressure

The reminder system creates natural upsell opportunities, but the framing is always care-first:

**After a drain clearing:**
"By the way — if this drain keeps giving you trouble, it might be worth having us camera-inspect the line. That way we can see if there's a root intrusion or a belly in the pipe causing repeat clogs. No pressure — just something to think about if it happens again. Want me to remind you in 3 months to check if it's recurred?"

**After a water heater install:**
"Your new unit should give you 10-15 good years. The one thing that extends its life is an annual flush — takes about 30 minutes. Want me to ping you next year when it's time?"

**After a winter emergency:**
"Now that the immediate fix is done — this burst happened because of uninsulated pipes in your crawl space. Before next winter, it's worth wrapping those pipes. It's a quick job and saves you from going through this again. Want me to reach out in October before it gets cold?"

Rules:
- Never suggest something in the same message as bad news or a bill
- Never follow up if the customer declines or ignores the suggestion
- Never frame it as "you should" — always "want me to" or "something to think about"
- Always provide the reasoning (why this matters to them), not just the offer
- One suggestion per interaction maximum. Don't stack upsells.
- Log every suggestion and response in the account's service history (migration 09)

### Reminder Management

Users can manage their reminders through conversation:

- "What reminders do I have?" → agent lists active reminders with next trigger dates
- "Cancel the filter reminder" → agent cancels and confirms
- "Push that back a month" → agent snoozes and confirms new date
- "Remind me sooner — make it 3 months instead of 6" → agent updates and confirms

Blake/CEO can also see all active reminders:
- "How many customer reminders are active?" → count and breakdown by type
- "What's going out this week?" → list of reminders triggering this week
- "Cancel all reminders for [customer]" → bulk cancel with confirmation

### Reminder Storage

Add to state manager:
- `createReminder(reminder: Reminder)` — creates and stores a reminder
- `getReminders(filter?: { role?, targetId?, status?, beforeDate? })` — query reminders
- `getNextReminder(targetId: string)` — get the soonest active reminder for a user
- `triggerReminder(id: string)` — mark as triggered, advance recurrence if applicable
- `snoozeReminder(id: string, until: string)` — snooze to new date
- `cancelReminder(id: string)` — mark as cancelled

Store reminders in `src/data/reminders.json` (seeded empty, populated at runtime).

### Pre-seeded Reminders for Demo

Seed a few reminders that demonstrate the system during the demo:

1. **Garcia — water heater annual flush** (trigger: March 16, 2026 — demo day)
   - Created after Marcus's October 2024 install
   - Shows the agent proactively reaching out about maintenance

2. **Chen — warranty expiry notice** (trigger: March 18, 2026 — 2 days from demo)
   - Shows in Blake's morning briefing as upcoming

3. **Blake — review Danny's callback rate** (trigger: April 1, 2026)
   - Shows that ops uses reminders for management tasks too

These give the judges something to see immediately and demonstrate the time-awareness of the system.

## Files to Create

- `src/telegram/ceo-channel.ts` — CEO channel posting and summary generation
- `src/agent/reminders.ts` — reminder creation, suggestion logic, execution engine
- `src/data/reminders.json` — reminder storage (seeded with demo reminders)

## Files to Modify

- `src/types.ts` — add `Reminder` interface, add CEO channel types
- `src/telegram/bot.ts` — add CEO group listener, add reminder check on startup / interval
- `src/telegram/handler.ts` — support CEO channel routing, handle reminder-related conversation
- `src/agent/conversation.ts` — add CEO conversation history
- `src/agent/directives.ts` — add `[POST_TO_CEO: ...]` and `[CREATE_REMINDER: ...]` directives
- `src/prompts/system-prompt.ts` — add CEO channel awareness, reminder system instructions, gentle upsell guidelines, specificity commitment
- `src/state/state.ts` — add reminder CRUD methods
- `src/telegram/startup.ts` — include upcoming reminders in morning briefing, trigger due reminders on startup
- `.env.example` — add `TELEGRAM_CEO_GROUP_ID`

## Acceptance Criteria

### CEO Channel

- **Given** the daily summary is triggered
  **When** it posts to the CEO channel
  **Then** it includes revenue, job count, emergency count, customer satisfaction, tech utilization percentages, and actionable flags — no individual dispatch details

- **Given** a pattern emerges (e.g., third emergency from same area this month)
  **When** the agent detects it
  **Then** a real-time flag is posted to the CEO channel with the pattern and a recommendation

- **Given** the CEO asks "how are we doing this week?"
  **When** the agent responds in the CEO channel
  **Then** the response is data-driven with trends, comparisons, and recommendations — not operational details

- **Given** a dispatch decision is made
  **When** ops receives the full reasoning
  **Then** the CEO channel receives nothing (unless it crosses a strategic threshold)

### Reminders — User-Initiated

- **Given** a customer says "remind me when I need to replace the filter"
  **When** the agent creates the reminder
  **Then** the agent responds with the exact trigger date ("I'll remind you on September 16th") and the reminder is stored with the customer's account

- **Given** Blake says "remind me to check Danny's callback rate next month"
  **When** the agent creates the reminder
  **Then** the agent confirms with the specific date and the reminder is tagged to appear in Blake's morning briefing on that date

- **Given** a tech says "remind me to bring the fitting Thursday"
  **When** the agent creates the reminder
  **Then** the agent confirms "Thursday morning before your first job" and the reminder targets the tech's channel

- **Given** a user asks "what reminders do I have?"
  **When** the agent responds
  **Then** it lists all active reminders with their next trigger dates

- **Given** a user says "cancel the filter reminder"
  **When** the agent processes it
  **Then** the reminder is cancelled and the agent confirms

### Reminders — Agent-Suggested

- **Given** a water heater install is completed
  **When** the agent sends the customer a follow-up
  **Then** it suggests an annual flush reminder with specific framing ("want me to ping you next March?") — not pushy, not automatic

- **Given** the customer declines or ignores the reminder suggestion
  **When** the agent processes the non-response
  **Then** it does NOT follow up, nag, or re-suggest

- **Given** the customer accepts the suggestion
  **When** the agent creates the reminder
  **Then** it confirms with the specific date and logs the suggestion acceptance in the account history

- **Given** an emergency repair involved a preventable root cause (e.g., uninsulated pipes)
  **When** the agent wraps up the emergency
  **Then** it mentions the preventive measure conversationally and offers a seasonal reminder — but not in the same message as the bill or bad news

### Reminders — Execution

- **Given** a reminder trigger date arrives
  **When** the agent processes due reminders
  **Then** the reminder fires to the correct channel with contextual, human-sounding language — not "AUTOMATED REMINDER:"

- **Given** a customer reminder fires for a water heater flush
  **When** the customer receives the message
  **Then** it references the original install, the tech who did it, and offers to schedule — framed as care, not sales

- **Given** a recurring reminder triggers
  **When** it is processed
  **Then** the next occurrence is automatically scheduled and the user can see the updated next date

### Specificity Commitment

- **Given** any reminder is created through any channel
  **When** the agent confirms creation
  **Then** the confirmation includes the exact date (not "soon", "later", "when it's time") the user will next be contacted about this reminder

- **Given** a user asks "when will I hear about the filter?"
  **When** the agent responds
  **Then** it gives the exact date from the stored reminder
