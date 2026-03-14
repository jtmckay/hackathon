# Shamrock Plumbing AI Agent
## Podium AI Hackathon Build Plan | March 14, 2026

---

## The Concept

An AI agent that autonomously operates emergency dispatch for Shamrock Plumbing, a real plumbing business owned by Blake. When a customer has an emergency, the agent takes over: assesses the situation, decides which tech to pull, communicates with the customer, dispatches the tech, handles all the downstream schedule chaos, and keeps everyone informed. Two Telegram channels show the full picture in real time.

> **One-line pitch:** "Blake built Shamrock Plumbing over 15 years. We downloaded his brain into an AI that handles his hardest operational problem: when everything goes wrong at once, who do you send where, and what do you tell everyone else?"

---

## The Two Channels

### Channel 1: Customer Channel
The customer talks to the bot here. This is the front door of the business. The customer describes their emergency, the bot qualifies it, makes decisions, and keeps the customer updated with ETAs, tech info, and pricing.

Blake can also see this channel. He sees how the bot is handling his customers in real time. But he doesn't need to intervene. The bot runs it.

### Channel 2: Operations Channel (Blake + Techs)
This is the back office. The bot posts the day's schedule here. When an emergency comes in, the bot posts its decision-making in real time: which tech it's pulling, why, what jobs are being displaced, and what the new schedule looks like. Techs get their dispatch orders here. Blake sees the reasoning behind every decision.

### Why Two Channels
The judges see both channels side by side during the demo. Left screen: the customer experience. Right screen: the operational decisions happening behind the scenes. They watch the same emergency play out from both perspectives simultaneously. This is the "wow" moment.

---

## What the Judges See

A customer messages in a panic. On the left channel, the bot calmly handles the customer, asks the right questions, and gives them an ETA. On the right channel, the bot is making hard decisions: pulling Marcus off the Johnson job because he's the closest senior tech, bumping Mrs. Chen's faucet repair to tomorrow (but sending her a personal apology because she's a 5-year customer), and briefing Blake on everything it did and why.

Same emergency. Two perspectives. Full autonomy.

---

## The Flow (Deep Dive)

### Step 1: Emergency Comes In (Customer Channel)

Customer messages: "There's water pouring through my ceiling!"

The bot responds immediately. No hold music. No "please describe your issue." It recognizes urgency from the language and shifts into emergency mode.

Bot asks targeted qualifying questions (fast, not a form):
- Where is the water coming from? (ceiling, walls, floor)
- Can you see the source? (burst pipe, overflowing fixture, unknown)
- Have you shut off the water main? (if not, bot gives instructions)
- Is there electrical near the water? (safety check)
- What's your address?

Bot checks: new customer or existing? If existing, pulls their history and address automatically.

Bot classifies severity:
- **Critical:** Active flooding, gas smell, sewage backup, electrical risk
- **Urgent:** No hot water in winter, single fixture leak contained, slow drain backing up
- **Routine:** Dripping faucet, running toilet, minor leak with bucket under it

> **Intent applied:** "Emergency calls get same-day response, no exceptions."

### Step 2: Bot Decides Who to Send (Operations Channel)

Bot posts to ops channel: "EMERGENCY INCOMING" with the details.

Bot evaluates every tech simultaneously:

For each tech, the bot considers:
- **Current job status:** Just started? Mid-job? Almost done? Can it be safely paused?
- **Skill match:** Is this tech qualified for the emergency type? (gas leak needs gas-certified tech)
- **Proximity:** How far are they from the emergency address?
- **Current customer value:** Is the tech currently serving a repeat customer or a new one?
- **Job bumpability:** How easy is it to reschedule the current job?

Bot applies Blake's intent hierarchy to make the call:
- Repeat customer's non-urgent job gets bumped LAST
- New customer's routine job gets bumped FIRST
- Junior tech never gets sent to an emergency alone
- If two techs are equally viable, pick the closer one

Bot posts its decision with full reasoning:
```
DECISION: Pulling Marcus from the Johnson drain clearing.
REASON: Marcus is senior-certified, 12 min from emergency address.
Johnson job is routine, customer is new (3 months), job can be
safely paused (water is already off). Next best option was Tyler
but he's mid-install on Mrs. Chen's water heater (5-year customer,
can't safely pause).
```

### Step 3: Dispatch (Both Channels)

**Operations Channel:**
Bot sends dispatch to Marcus:
```
EMERGENCY DISPATCH
Customer: [name]
Address: [address]
Issue: Active water leak through ceiling, source unknown
Customer has been instructed to shut off main
ETA requested: ASAP
Current job (Johnson) is paused. Will reschedule.
```

**Customer Channel:**
Bot tells the customer:
```
I've dispatched Marcus, one of our senior technicians.
He's about 15 minutes away. He'll call you when he's
en route. In the meantime, keep the main water shut off
and move any valuables away from the water if you can
do so safely.
```

> **Intent applied:** "Never let a customer feel like they're being passed around. One point of contact."

### Step 4: Handle Displaced Jobs (Operations Channel)

Bot identifies every job affected by pulling Marcus:
- Johnson drain clearing (paused, needs rescheduling)
- 2:00pm Garcia faucet repair (Marcus was assigned, needs reassignment or reschedule)
- 3:30pm new customer consultation (Marcus was assigned)

For each displaced job, the bot makes a separate decision:

**Johnson (paused job):**
- New customer, 3 months. Routine drain clearing.
- Bot checks: can another tech pick this up today? If yes, reassign. If no, reschedule to tomorrow.
- Bot messages Johnson from the customer channel (or direct): "Hi Mr. Johnson, we had an emergency come in and need to reschedule your drain clearing. I have Tyler available tomorrow at 10am. Does that work?"

**Garcia (2:00pm, repeat customer):**
- 5-year customer. High value.
- Intent says: repeat customers get priority.
- Bot tries to reassign to another available tech first. If no tech available, reschedules to the earliest possible slot.
- Bot messages Garcia: "Hi Mrs. Garcia, we need to adjust your appointment today. I can have Tyler there at 3:00pm instead of Marcus at 2:00pm. Same great work, just a different tech. I apologize for the shuffle."

**New customer consultation (3:30pm):**
- Brand new customer. No history.
- Lowest priority for preservation.
- Reschedule to next available slot.
- Professional but brief: "We need to reschedule your consultation due to an emergency. I have Thursday at 1:00pm available. Would that work?"

> **Intent applied:** "Repeat customers always get priority." Different customers get different treatment based on their relationship with the business.

### Step 5: Schedule Rebuild (Operations Channel)

Bot posts the updated schedule:
```
SCHEDULE UPDATE (post-emergency)

Marcus:
  - NOW: Emergency - [address] - active ceiling leak
  - Est. completion: 1:30pm
  - 2:00pm: OPEN (Garcia reassigned to Tyler)
  - 3:30pm: OPEN (new customer rescheduled to Thursday)

Tyler:
  - 11:00am: Current job (Ramirez toilet install)
  - 1:00pm: Johnson drain clearing (picked up from Marcus)
  - 3:00pm: Garcia faucet repair (moved from 2pm Marcus)

Jake:
  - [unchanged]

Danny:
  - [unchanged]

DISPLACED:
  - New customer consultation → Thursday 1:00pm (Marcus)
```

### Step 6: Brief Blake (Operations Channel)

Bot sends Blake a summary:
```
BLAKE BRIEFING:

Emergency dispatched. Active ceiling leak at [address].
Marcus pulled from Johnson drain clearing (new customer,
routine, safe to pause). Johnson rescheduled to tomorrow
with Tyler. Garcia moved to Tyler at 3pm (preserved
same-day service for repeat customer). New customer
consultation pushed to Thursday.

All affected customers have been notified.
No action needed from you unless you want to override.
```

### Step 7: Resolution and Follow-Up

When Marcus messages "job complete" in the ops channel:
- Bot updates his status to available
- Bot messages the customer: "Marcus has wrapped up. How did everything go? Is the leak fully resolved?"
- If customer confirms: bot asks for a review, logs the job, updates customer history
- If customer reports an issue: bot escalates appropriately based on intent

---

## Intent Statements (Replace with Blake's Actual Answers)

1. **Emergency calls get same-day response, no exceptions.** Dispatch immediately even if it means bumping a non-urgent job.
2. **Repeat customers always get priority.** When choosing whose job to bump, bump the newest customer's job first. When rescheduling, give the repeat customer the best available slot.
3. **Never send a junior tech to an emergency alone.** Emergencies require mid-level or senior techs. If only a junior is available, call Blake.
4. **If a job is going to cost more than the estimate, contact the customer BEFORE doing the work.** No surprises on cost. The bot handles this communication.
5. **Safety first.** If there's any electrical risk near water, instruct the customer to leave the area. If there's a gas smell, tell them to evacuate and call 911 first.
6. **Own mistakes fast.** If the emergency was caused by a previous Shamrock job, acknowledge it immediately and prioritize the fix at no charge.
7. **Protect the relationship over the revenue.** A displaced repeat customer gets a personal apology and priority rebook. Don't treat them like a number.
8. **Keep Blake informed but don't wait for him.** Brief him after decisions are made. He trusts the system. Only escalate if the situation is outside normal bounds (injury, property damage claim, all techs unavailable).
9. **Techs need context.** When dispatching to an emergency, give the tech everything: customer name, address, problem description, what the customer has already done (shut off water, etc.), and any relevant history.
10. **After every emergency, log and learn.** Record what happened, what decisions were made, and what the outcome was. This makes the next emergency smoother.

---

## Hour-by-Hour Build Plan

> **Total build time: ~6.5 hours (10:30am - 5:00pm with lunch).** Submit by 4:00pm. Demos at 5:00pm.

---

### Pre-Work (Before Hackathon)

None of this is project code. It's preparation.

- Interview Blake. Record it. Extract intent statements. Get real pricing, real service area, real tech names if he's comfortable sharing.
- Create the Telegram bot via BotFather. Get the API token. Create two group chats: "Shamrock Customers" and "Shamrock Ops."
- Write sample data as JSON files:
  - 4 tech profiles with skills, seniority, and personality notes
  - 15-20 customer profiles with history and value tiers
  - Monday's schedule: 6-8 jobs across the 4 techs
  - Job catalog with pricing and duration estimates
- Draft the system prompt with intent statements. This is your most important artifact. Spend real time on it.
- Test that your dev environment works: Anthropic SDK, Telegram bot library, basic message send/receive.

---

### 10:30 - 11:15 | Foundation (45 min)

**Goal: Both channels live. Bot responds. Data loaded. Claude connected.**

- Set up project repo with file structure
- Load all sample data into SQLite or JSON store
- Connect Telegram bot to both channels
  - Customer channel: bot receives and responds to customer messages
  - Ops channel: bot posts schedule updates and dispatch decisions
- Wire up Claude API with system prompt containing:
  - Blake's intent statements
  - Current schedule state (injected fresh on every call)
  - Tech roster with current status
  - Customer database
- Test: send "hello" in customer channel, bot responds as Shamrock Plumbing
- Test: bot posts today's schedule in ops channel on command

> **Checkpoint:** Both channels working. Bot responds in customer channel. Bot can post to ops channel. Claude is reasoning with business data.

---

### 11:15 - 12:00 | Emergency Intake (45 min)

**Goal: Customer can report an emergency and the bot qualifies it correctly.**

- Build the emergency qualification flow:
  - Bot detects urgency from language ("flooding", "burst", "pouring", "gas smell", "emergency")
  - Bot asks qualifying questions (source, location, safety, address)
  - Bot classifies severity (critical / urgent / routine)
  - Bot checks customer database: new or existing?
- Build the safety response:
  - If electrical risk: immediate safety instructions
  - If gas: tell customer to evacuate, call 911
  - If flooding: walk customer through shutting off water main
- Bot posts to ops channel: "EMERGENCY INCOMING" with classified details

> **Checkpoint:** You can message the bot as a panicked customer, it stays calm, qualifies the emergency, gives safety instructions, and posts the alert to the ops channel.

---

### 12:00 - 1:00 | Lunch

Eat. Write down 10 curveball scenarios on a napkin. You'll need them at 2:30.

---

### 1:00 - 2:00 | Dispatch Decision Engine (1 hour)

**Goal: Bot autonomously picks the right tech and dispatches them.**

This is the core of the whole product. Spend the most time here.

- Build tech evaluation logic:
  - For each tech: pull current job, check status, calculate proximity to emergency, check skill match
  - Score each tech on: availability + skill match + proximity + current job bumpability
  - Apply intent hierarchy: don't bump repeat customers first, don't send juniors alone, prefer senior techs for emergencies
- Build the dispatch action:
  - Bot posts decision with reasoning to ops channel (which tech, why, what's being displaced)
  - Bot sends dispatch details to ops channel tagged to the tech
  - Bot sends ETA and tech info to customer in customer channel
- Build schedule mutation:
  - Remove pulled tech from their current and upcoming jobs
  - Insert emergency job into their schedule
  - Mark displaced jobs as "needs rescheduling"

> **Checkpoint:** Emergency comes in, bot evaluates all 4 techs, picks the right one with reasoning, dispatches them, and the customer gets an ETA. Ops channel shows the full decision.

---

### 2:00 - 2:30 | Cascade and Rebuild (30 min)

**Goal: All displaced jobs get handled. Schedule is rebuilt. Everyone is notified.**

- Build displaced job handler:
  - List all jobs affected by pulling the tech
  - For each: can another tech pick it up today? If yes, reassign. If no, reschedule.
  - Apply intent: repeat customers get priority rebook and personal messaging, new customers get professional reschedule
- Build customer notification:
  - Different message templates based on customer tier
  - Messages sent in customer channel (or simulated direct messages)
- Build schedule rebuild:
  - Post updated schedule to ops channel showing all changes
- Build Blake briefing:
  - Summary of emergency, decisions made, reasoning, and current state
  - Posted to ops channel

> **Checkpoint:** Full cascade works. Emergency triggers dispatch, displaced jobs get redistributed or rescheduled, all customers notified with intent-appropriate messaging, Blake gets a briefing, ops channel shows the new schedule.

---

### 2:30 - 3:30 | Stress Testing (1 hour)

**Goal: Throw every curveball you can think of. Fix what breaks.**

Test these scenarios:

- **Double emergency:** While Marcus is on the first emergency, a second one comes in. What does the bot do with only 3 techs left?
- **All techs busy on critical jobs:** No one can be safely pulled. How does the bot handle the customer?
- **Customer is hysterical:** Message is all caps, panicked, barely coherent. Does the bot stay calm and extract the info it needs?
- **False emergency:** Customer says "emergency" but it's actually a dripping faucet. Does the bot correctly downgrade?
- **After hours:** Emergency comes in at 9pm. Does the bot handle the after-hours logic?
- **Repeat customer emergency:** Mrs. Garcia, a 5-year customer, has the emergency. Does the bot treat her differently?
- **Tech pushback:** Tech messages "I can't leave this job right now." How does the bot respond?
- **Previous Shamrock job caused it:** Customer says "you guys were just here last week and now my ceiling is leaking." Does the bot own it per Blake's intent?
- **Customer asks about cost mid-emergency:** "How much is this going to cost me?" Does the bot quote appropriately?
- **Multiple cascading disruptions:** Emergency + tech calls in sick + a job runs long, all in the same hour.

For each scenario: test it, evaluate the response, tune the system prompt if needed. This is the most important hour. The judges will throw curveballs and this is where you prepare for them.

> **Checkpoint:** You've tested 10+ curveballs. The bot handles each one with clear reasoning and intent-driven decisions. You know where it's strong and where it's fragile.

---

### 3:30 - 4:00 | Polish and Submit (30 min)

**Goal: Demo-ready. Submitted by 4:00pm.**

- Reset data to clean Monday morning state
- Pre-load a fully scheduled Monday (6-8 jobs, 4 techs, mix of customer types)
- Test the full demo flow once: emergency in customer channel → dispatch decision in ops channel → cascade → rebuild → briefing
- Make sure the bot's tone sounds like Blake's business, not like a corporate chatbot
- Clean up any message formatting issues in Telegram
- Submit via Google form

---

### 4:00 - 5:00 | Demo Prep (1 hour)

**Goal: Rehearsed. Confident. Ready for judges.**

- Set up two devices/screens: one showing customer channel, one showing ops channel
- Plan who on the team narrates vs. who plays the customer vs. who plays the tech
- Run through the demo script 2-3 times
- Prepare for Q&A: know your intent statements cold, know why you picked emergency triage, know the architecture
- Reset data to clean state one final time before demo

---

## Demo Script

### Setup (before you start talking)

Two screens visible to judges. Left: Customer channel. Right: Ops channel. Ops channel already shows today's schedule with all 4 techs and their jobs.

### Opening (30 seconds)

"This is Shamrock Plumbing. Real business, real owner named Blake, real techs, real customers. We interviewed Blake and extracted his business judgment into an AI agent. The agent runs Blake's hardest operational problem: emergency dispatch. When a pipe bursts at 11am on a packed Monday, who do you pull? What do you tell the displaced customers? How do you rebuild the day? Blake used to do all of this from under a sink while his phone buzzed. Now the AI does it."

### The Emergency (2-3 minutes)

Point to the ops channel: "Here's Monday's schedule. Four techs, eight jobs, fully loaded."

Someone on the team messages the customer channel as a panicked homeowner: "Help, water is pouring from my ceiling, I don't know what to do"

Watch both channels simultaneously:
- **Left (customer):** Bot stays calm. Asks where the water is coming from. Asks if they can get to the water main. Gives safety instructions. Gets the address.
- **Right (ops):** Bot posts EMERGENCY INCOMING. Evaluates all 4 techs. Posts its decision with full reasoning. Dispatches the chosen tech. Shows the displaced jobs. Sends different notifications to different customers based on their relationship. Posts the rebuilt schedule. Briefs Blake.

"Notice what just happened. The customer got a calm, helpful response in under a minute. Behind the scenes, the AI evaluated four techs, chose Marcus because he's senior-certified and closest, bumped the new customer's job first instead of the repeat customer's, and rebuilt the entire schedule. Every decision was driven by Blake's business values."

### The Curveball (1 minute)

"But let's make it harder." Someone messages as a tech: "Hey, I'm feeling really sick, I need to go home."

Watch the ops channel: the bot pulls that tech's remaining jobs, redistributes what it can, reschedules the rest, notifies all affected customers, and briefs Blake. The schedule rebuilds again.

"The business just lost a tech in the middle of a day that already had an emergency. The AI handled it without anyone asking it to."

### Intent Reveal (30 seconds)

"Every decision was driven by intent statements we extracted from Blake. Repeat customers get priority. Emergencies are same-day no matter what. Never send a junior alone. No cost surprises. If Blake's values change, we update the intent statements and every future decision shifts. This isn't a script. It's judgment."

### Invite Judges (remaining time)

"The bot is live. Message it. Be a customer with a weird problem. Be an angry customer. Be a tech who can't make it. Try to break it."

---

## Sample Data Structure

### Tech Roster

```json
{
  "techs": [
    {
      "name": "Marcus",
      "seniority": "senior",
      "years": 8,
      "specialties": ["water heaters", "gas lines", "emergency repair", "remodels"],
      "certifications": ["gas certified", "backflow certified"],
      "notes": "Blake's most trusted tech. Great with nervous customers. Send him to the hard jobs and the important clients.",
      "area": "Lehi / American Fork"
    },
    {
      "name": "Tyler",
      "seniority": "mid",
      "years": 3,
      "specialties": ["drains", "faucets", "toilets", "water heaters"],
      "certifications": ["backflow certified"],
      "notes": "Reliable and fast. Good with routine jobs. Not ready for gas work or complex emergencies solo.",
      "area": "Orem / Provo"
    },
    {
      "name": "Jake",
      "seniority": "mid",
      "years": 2,
      "specialties": ["drains", "faucets", "general maintenance", "water softeners"],
      "certifications": [],
      "notes": "Fastest drain clearer on the team. Still building customer skills. Don't send to first-time customers alone if avoidable.",
      "area": "Pleasant Grove / Lindon"
    },
    {
      "name": "Danny",
      "seniority": "junior",
      "years": 6,
      "specialties": ["general maintenance", "faucets", "toilets"],
      "certifications": [],
      "notes": "Apprentice. Learning fast but needs supervision on anything complex. Great attitude. Customers like him but he's not ready for emergencies.",
      "area": "Spanish Fork / Springville"
    }
  ]
}
```

### Monday Schedule

```json
{
  "date": "2026-03-16",
  "jobs": [
    {
      "id": 1,
      "tech": "Marcus",
      "time": "9:00",
      "duration_hrs": 2,
      "type": "Drain clearing",
      "customer": "Johnson",
      "customer_since": "2025-12",
      "address": "482 W 1200 N, Lehi",
      "status": "in_progress",
      "notes": "Slow drain in basement. Routine.",
      "bumpable": true
    },
    {
      "id": 2,
      "tech": "Marcus",
      "time": "12:00",
      "duration_hrs": 2,
      "type": "Faucet repair",
      "customer": "Garcia",
      "customer_since": "2021-03",
      "address": "1155 E 200 S, Lehi",
      "status": "scheduled",
      "notes": "Kitchen faucet leaking at base. Repeat customer, always great to work with. Referred 3 other customers.",
      "bumpable": false
    },
    {
      "id": 3,
      "tech": "Marcus",
      "time": "3:30",
      "duration_hrs": 1,
      "type": "Consultation",
      "customer": "New - Webber",
      "customer_since": null,
      "address": "290 S 500 W, Lehi",
      "status": "scheduled",
      "notes": "New customer. Wants quote on bathroom remodel. Never used Shamrock before.",
      "bumpable": true
    },
    {
      "id": 4,
      "tech": "Tyler",
      "time": "9:00",
      "duration_hrs": 4,
      "type": "Water heater install",
      "customer": "Chen",
      "customer_since": "2020-06",
      "address": "3344 N Maple Dr, Orem",
      "status": "in_progress",
      "notes": "Replacing 40-gal gas water heater. 5-year customer. Can NOT be interrupted mid-install safely.",
      "bumpable": false
    },
    {
      "id": 5,
      "tech": "Tyler",
      "time": "2:00",
      "duration_hrs": 1.5,
      "type": "Toilet replacement",
      "customer": "Ramirez",
      "customer_since": "2024-08",
      "address": "887 W Center St, Orem",
      "status": "scheduled",
      "notes": "Replacing cracked toilet base. Parts pre-ordered and on Tyler's truck.",
      "bumpable": true
    },
    {
      "id": 6,
      "tech": "Jake",
      "time": "9:30",
      "duration_hrs": 1.5,
      "type": "Drain clearing",
      "customer": "Patterson",
      "customer_since": "2022-01",
      "address": "1540 W 600 N, Pleasant Grove",
      "status": "in_progress",
      "notes": "Kitchen drain backing up. Repeat customer, always pays on time.",
      "bumpable": true
    },
    {
      "id": 7,
      "tech": "Jake",
      "time": "12:00",
      "duration_hrs": 2,
      "type": "Water softener service",
      "customer": "Thorpe",
      "customer_since": "2023-06",
      "address": "225 E State Rd, Lindon",
      "status": "scheduled",
      "notes": "Annual water softener maintenance. Customer is flexible on timing.",
      "bumpable": true
    },
    {
      "id": 8,
      "tech": "Danny",
      "time": "10:00",
      "duration_hrs": 2,
      "type": "Faucet install",
      "customer": "Park",
      "customer_since": "2025-09",
      "address": "4120 S Mill Rd, Spanish Fork",
      "status": "in_progress",
      "notes": "Bathroom faucet install. Straightforward job, good for Danny's skill level. Second-time customer.",
      "bumpable": true
    }
  ]
}
```

### Customer Value Tiers

```
Tier 1 (VIP): Customer 3+ years, multiple jobs, referral source
  → Garcia, Chen, Patterson
  → Never bump unless no alternative. Personal apology if disrupted.

Tier 2 (Regular): Customer 1-3 years, at least 2 jobs
  → Ramirez, Thorpe, Park
  → Can be rescheduled but prioritize same-day if possible.

Tier 3 (New): Less than 1 year or first job
  → Johnson, Webber
  → First to be rescheduled. Professional but brief communication.
```

### Job Catalog (Pricing)

```
Emergency/urgent:
  Pipe burst repair:        $200-500,   1-3 hrs,  mid+ tech
  Gas leak diagnosis:       $150-300,   1-2 hrs,  senior only (gas cert)
  Sewage backup:            $250-600,   2-4 hrs,  mid+ tech
  Water heater emergency:   $200-400,   1-3 hrs,  senior preferred
  Emergency after-hours surcharge: +$150

Routine:
  Drain clearing:           $150-250,   1-2 hrs,  any tech
  Faucet repair:            $100-300,   1-2 hrs,  any tech
  Toilet repair/replace:    $150-400,   1-3 hrs,  any tech
  Water heater install:     $800-1500,  3-5 hrs,  senior only
  Water softener service:   $100-200,   1-2 hrs,  any tech
  Consultation/quote:       Free,       30-60 min, any tech
```

---

## What NOT to Build

- Web UI or dashboard. Telegram IS the interface.
- RAG or vector database. Data fits in the system prompt.
- Authentication. This is a demo.
- Real GPS or routing. "Marcus is 12 minutes away" is hardcoded and fine.
- Customer intake for non-emergencies. Keep it focused. If a judge messages with a routine request, the bot can handle it conversationally but the deep workflow is emergency triage.
- Pretty anything. Build the brain.
