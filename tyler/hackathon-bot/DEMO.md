# Shamrock Plumbing Dispatch — Demo Runbook

## Telegram Groups

| Group | ID | Who's in it | What it sees |
|---|---|---|---|
| Operator | 5223707556 | Blake + ops team | Everything — dispatch decisions, reasoning, schedule, briefings |
| Customer | 5139115562 | Customers | Only customer-facing responses + their notifications |
| Tech | -4970701789 | Field techs | Dispatch orders directed at them + job status replies |

## Setup

```bash
cd tyler/hackathon-bot
# .env already has the three group IDs and MULTI_CHANNEL_ENABLED=true
npm run start:dev
```

Bot sends to each group on `/start`:
- Operator: "Online. Operator channel ready." + schedule
- Customer: "Hi! You've reached Shamrock Plumbing. How can I help you today?"
- Tech: "Dispatch online. Report job completions, status updates, or issues here." + schedule

On startup it seeds: 4 techs, 8 customers, 10 job types, 8 scheduled jobs.

---

## Reset Between Scenarios

Send `/reset` in the **Operator group** — wipes DB, re-seeds, clears all conversation history and state. Completes in ~2 seconds. (Only the operator group can reset — ignored everywhere else.)

Send `/schedule` in the **Operator or Tech group** to see the current state.

---

## Demo Scenarios

### Scenario 1 — Emergency Intake + Dispatch (Core Flow)

**Step 1** — In CUSTOMER group:
```
There's water pouring through my ceiling!
```
Customer group: Bot responds calmly, asks about water source and main.
Operator group: `🚨 EMERGENCY INCOMING / Severity: Critical / Status: Qualifying`

**Step 2** — In CUSTOMER group:
```
It's Elena Martinez, I'm at 1247 Oak Street
```
Customer group: Bot recognizes Elena (platinum, customer since March 2018), gives water main instructions, confirms Mike is on the way.
Operator group: DISPATCH DECISION (Mike selected, all techs evaluated) + DISPATCH ORDER.
Tech group: DISPATCH ORDER — MIKE RODRIGUEZ with address + issue + safety notes.
Customer group: Cascade fires — Patel's job notification sent automatically.
Operator group: Schedule rebuild + Blake briefing.

---

### Scenario 2 — Tech Calls In Sick

After `/reset` in Operator group. In TECH group:
```
Mike: Not feeling well today, heading home
```
Tech group: "Feel better Mike. Jobs are covered."
Operator group: Cascade rebuild — Mike's jobs redistributed + Blake briefing.
Customer group: Affected customers notified (tier-appropriate messages).

---

### Scenario 3 — Job Completion

After dispatching (Scenario 1). In TECH group:
```
Mike: Job done, all wrapped up at Martinez
```
Tech group: "Got it Mike. Elena has been followed up with. You're clear for the rest of the day."
Customer group: "Hi Elena, Mike has wrapped up. How did everything go?"
Operator group: Schedule updates, Mike → available.

---

### Scenario 4 — Gas Emergency (Safety First)

After `/reset`. In CUSTOMER group:
```
I smell gas in my kitchen
```
Customer group: Bot immediately says evacuate + call 911. No questions first.
Operator group: Critical alert. Carlos dispatched (gas_certified, west zone master plumber).
Tech group: Dispatch order to Carlos.

---

### Scenario 5 — False Emergency (Downgrade)

After `/reset`. In CUSTOMER group:
```
I have an emergency, my faucet has been dripping for like 3 weeks
```
Customer group: Bot recognizes Routine — no alert, no dispatch. Offers to schedule a repair.
Operator group: Nothing. Clean.

---

### Scenario 6 — Callback Detection

After `/reset`. In CUSTOMER group:
```
Hi, your guys were here last week for a water heater and now I have water dripping from the ceiling
```
Customer group: Bot apologizes, offers to fix at no charge.
Operator group: `⚠️ POSSIBLE CALLBACK — customer, recent work, current issue`.

---

### Scenario 7 — VIP Customer Emergency

After `/reset`. In CUSTOMER group:
```
This is Priya Patel, there's sewage backing up in my restaurant kitchen
```
Customer group: Bot recognizes Priya (platinum, April 2017, restaurant owner). Extra personal warmth, top priority language.
Operator group: Alert + dispatch with platinum tier noted.
Tech group: Dispatch order.

---

### Scenario 8 — Double Emergency

After `/reset`, trigger Scenario 1 to dispatch (Mike out). Then in CUSTOMER group:
```
HELP my basement is flooding!!!
```
Customer group: Bot stays calm, qualifies second customer.
Operator group: Second alert fires. Dispatch evaluates remaining 3 techs — Mike shown as unavailable/on emergency. Picks next best.

---

### Scenario 9 — All Techs Unavailable (Escalation)

After `/reset`. In OPERATOR group, tell Blake: "Imagine all 4 techs are mid-install, nothing bumpable." Then in CUSTOMER group:
```
My pipe just burst, water everywhere
```
Customer group: Bot evaluates all techs, all blocked. "I'm contacting our owner Blake directly to get someone to you as fast as possible."
Operator group: `⚠️ ALL TECHS UNAVAILABLE — ESCALATING TO BLAKE` with all 4 techs and why each is excluded.

---

## Talking Points for Judges

**"How does it decide who to dispatch?"**
Claude evaluates every tech simultaneously: skill/cert match, seniority (JUNIOR can't go alone), current job bumpability, zone proximity (drive time matrix), and which customer's job would be displaced. It applies Blake's intent hierarchy in order and posts full reasoning.

**"What happens to the displaced jobs?"**
The cascade fires automatically alongside dispatch — Claude reassigns jobs where another tech has a skill-matched gap, reschedules the rest. Each customer gets a tier-appropriate notification (VIP gets a personal apology, new customers get a brief professional message).

**"Is it just a chatbot?"**
No — it calls real Prisma mutations. When a tech is dispatched, the DB is updated: emergency job created, current job paused, future jobs displaced. When cascade runs, jobs are reassigned and rescheduled in the DB. `/schedule` reflects reality after every decision.

**"What if something goes wrong?"**
The system is idempotent for demo recovery: `/reset` restores everything to seed state in ~2 seconds. Each demo scenario can be run independently.

---

## Known Behaviors

- Messages sent while bot is processing are dropped silently (prevents duplicate responses)
- Bot shows "typing..." for the full duration of Claude processing (1–3 seconds typically)
- All markdown stripped from responses — plain text only
- After-hours surcharge computed at runtime — bot knows definitively if it's after-hours
- Tech `currentJobId` updated live in DB on every dispatch and completion
