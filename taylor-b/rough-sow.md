SOW: Shamrock Plumbing AI Dispatch Agent

  Business Context                                                              
   
  Blake has built Shamrock Plumbing over 15 years. His hardest operational      
  problem isn't the plumbing — it's the chaos that follows an emergency: who do
  you pull from where, what do you tell the customers you're disrupting, and how
   do you rebuild a day that just fell apart, all while you're already under a
  sink with your phone buzzing.

  Today, Blake handles this personally. That means every emergency competes for
  his attention at the exact moment his techs and customers need him most. The
  cost is real: slower dispatch, inconsistent customer communication, and
  scheduling decisions that don't always reflect his values — because he's
  making them fast, under pressure, without full information.

  This project embeds Blake's business judgment into an AI agent that
  autonomously handles emergency dispatch end-to-end: qualifying the situation,
  selecting and dispatching the right tech, managing the downstream schedule
  disruption, and keeping every affected party informed — all while briefing
  Blake after the fact, not before it.

  Jobs to Be Done

  1. When a customer has a plumbing emergency, I want to reach someone
  immediately and get clear next steps, so I don't feel abandoned or have to
  figure out what to do on my own.
  2. When an emergency comes in, I want the right tech dispatched without
  waiting for Blake, so response time doesn't depend on his availability.
  3. When a tech gets pulled for an emergency, I want every displaced job
  handled with an appropriate message to each affected customer, so no one falls
   through the cracks.
  4. When the day gets disrupted, I want the schedule rebuilt automatically with
   reasoning I can review, so Blake can trust the outcome without having to
  reconstruct it himself.
  5. When decisions are made on Blake's behalf, I want to see the reasoning
  behind each one, so I can verify the agent is acting in line with my business
  values.
  6. When the demo runs, I want judges to watch the same emergency play out from
   two perspectives simultaneously, so the autonomy and intelligence of the
  system are immediately legible.

  User Scenarios

  - Customer emergency intake: A homeowner messages "water is pouring through my
   ceiling." The bot immediately recognizes urgency, asks targeted qualifying
  questions (source, location, water main status, electrical proximity), gives
  safety instructions, and classifies severity — all without the customer
  feeling like they're filling out a form.
  - Autonomous dispatch decision: The bot evaluates all four techs
  simultaneously against the emergency — skill match, proximity, current job
  status, customer value — and selects the best option. It posts its full
  reasoning to the ops channel before dispatching, so Blake can see exactly why
  Marcus was chosen over Tyler.
  - Cascading schedule rebuild: Marcus gets pulled mid-morning. The bot
  identifies every downstream job affected, decides for each whether to reassign
   or reschedule, sends different messages to different customers based on their
   relationship with the business (VIP gets a personal apology and priority
  rebook; new customer gets a professional but brief reschedule), and posts the
  rebuilt schedule.
  - Blake briefing: After the emergency is dispatched and the schedule is
  rebuilt, the bot posts a concise summary to the ops channel: what happened,
  who was dispatched, what was displaced, why each decision was made. Blake
  reviews it, not approves it.
  - Curveball: double emergency: A second emergency comes in while Marcus is
  already deployed. The bot reassesses the remaining three techs, applies the
  same intent hierarchy, and dispatches with the same transparency — flagging to
   Blake if the situation exceeds normal bounds (e.g., only a junior available).
  - Curveball: previous Shamrock job implicated: A customer reports that "you
  guys were just here last week and now my ceiling is leaking." The bot
  acknowledges this immediately, prioritizes the fix, and flags the situation to
   Blake — consistent with the intent that mistakes get owned fast.
  - Live judge interaction: A judge messages the customer channel mid-demo. The
  bot handles it in character — whether the judge acts as a panicked customer,
  an angry customer, or a tech who can't make it to their next job.

  Scope

  In scope:

  - Telegram-based dual-channel interface (customer channel and ops channel)
  - Emergency qualification flow with severity classification (critical / urgent
   / routine)
  - Safety response logic for electrical risk, gas, and active flooding
  - Tech evaluation and dispatch decision engine using Blake's intent hierarchy
  - Displaced job handler with customer-tier-aware messaging
  - Schedule rebuild and ops channel posting
  - Blake briefing after each dispatch
  - Job resolution and follow-up flow (completion confirmation, review request)
  - Stress-tested curveball handling (double emergency, all techs busy,
  after-hours, tech callout, cost inquiry mid-emergency)
  - Demo script and live judge interaction

  Out of scope:

  - Web UI or dashboard — Telegram is the interface
  - RAG or vector database — data fits in the system prompt
  - Authentication or access control
  - Real GPS or live routing — proximity is hardcoded and sufficient for demo
  - Customer intake workflows for non-emergency requests
  - OAuth, multi-factor, or any auth layer
  - Production deployment or real customer data

  Deliverables

  1. Dual Telegram channel interface — customer-facing bot and ops channel with
  real-time posting
  2. Emergency qualification engine — urgency detection, targeted questioning,
  severity classification, safety response logic
  3. Dispatch decision engine — multi-tech evaluation with intent-ranked
  selection and ops channel reasoning post
  4. Cascading schedule manager — displaced job handler, customer-tier-aware
  messaging, schedule rebuild, and Blake briefing
  5. System prompt with Blake's intent statements — the core artifact encoding
  his business judgment
  6. Sample data set — four tech profiles, eight Monday jobs, customer tiers,
  and job catalog
  7. Stress-tested curveball coverage — ten-plus edge cases validated and
  prompt-tuned
  8. Demo-ready state — clean Monday schedule, rehearsed flow, two-screen setup

  Acceptance Criteria

  - A customer reporting an emergency receives a calm, qualifying response
  within seconds — no hold music, no form, no hand-off
  - Given a fully scheduled Monday, the bot selects the correct tech for a
  ceiling leak emergency with reasoning that reflects Blake's intent hierarchy
  (seniority, proximity, customer value, job bumpability)
  - Every job displaced by an emergency dispatch receives appropriate handling:
  reassignment if possible, reschedule if not, with messaging that matches the
  customer's relationship tier
  - VIP customers receive a personal apology and priority rebook; new customers
  receive a professional but brief reschedule
  - The ops channel shows the full decision chain — emergency alert, dispatch
  reasoning, displaced job decisions, rebuilt schedule, and Blake briefing —
  without Blake initiating any of it
  - A second emergency dispatched while the first is active produces a coherent
  response using the remaining tech pool
  - A customer who implies a previous Shamrock job caused the issue receives an
  immediate acknowledgment consistent with Blake's intent to own mistakes fast
  - Judges can message the live bot and receive responses that stay in character
   and reflect Blake's business values
  - The demo runs end-to-end without manual intervention: emergency in customer
  channel → full dispatch and cascade in ops channel → schedule rebuild → Blake
  briefing

  Assumptions & Constraints

  - Blake's intent statements are finalized before the build begins — they are
  the load-bearing artifact; late changes require system prompt rework
  - Tech proximity is hardcoded (e.g., "Marcus is 12 minutes away") — no live
  GPS or routing API
  - All customer, tech, and job data is sample data stored as JSON; no real
  customer data is used
  - The Telegram bot token and channel IDs are created and tested before the
  build window opens
  - The Anthropic SDK and Telegram bot library are confirmed working in the dev
  environment before 10:30am
  - The build window is approximately 6.5 hours (10:30am–5:00pm), with
  submission by 4:00pm and demo at 5:00pm
  - No real money, real customers, or real dispatch decisions are made — this is
   a demo environment
  - Two screens or devices are available for the demo to show both channels
  simultaneously