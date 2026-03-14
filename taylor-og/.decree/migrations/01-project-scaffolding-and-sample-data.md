---
routine: develop
---
# 01: Project Scaffolding and Sample Data

## Overview

Set up the Node.js/TypeScript project with all dependencies and create the complete sample data set that powers every downstream migration. This is the foundation — every other migration reads from these data structures.

## Requirements

### Project Setup

Create a Node.js project in the repository root with TypeScript:

```
package.json
tsconfig.json
src/
  index.ts          — entry point (placeholder for now)
  data/
    techs.json
    customers.json
    schedule.json
    jobs-catalog.json
    service-area.json
    policies.json
  state/
    state.ts        — in-memory state manager (load, mutate, query)
```

Dependencies:
- `typescript`, `tsx` (for running TS directly)
- `@anthropic-ai/sdk` (Claude API)
- `telegraf` (Telegram bot framework)
- `dotenv` (environment variables)

Dev dependencies:
- `vitest` (testing)
- `@types/node`

Create a `.env.example` with placeholders:
```
ANTHROPIC_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CUSTOMER_GROUP_ID=
TELEGRAM_OPS_GROUP_ID=
```

### Sample Data

All data lives in `src/data/` as JSON files. The state manager loads these at startup and holds a mutable copy in memory.

#### techs.json — 4 tech profiles

```json
[
  {
    "id": "marcus",
    "name": "Marcus",
    "seniority": "senior",
    "years": 8,
    "specialties": ["water heaters", "gas lines", "emergency repair", "remodels"],
    "certifications": ["gas certified", "backflow certified"],
    "currentLocation": "Lehi / American Fork",
    "status": "on_job",
    "currentJobId": 1,
    "notes": "Blake's most trusted tech. Great with nervous customers. Send him to the hard jobs and the important clients.",
    "metrics": {
      "avgCallbackRate": 0.02,
      "avgRating": 4.9,
      "emergencyResponseCount": 47
    }
  },
  {
    "id": "tyler",
    "name": "Tyler",
    "seniority": "mid",
    "years": 3,
    "specialties": ["drains", "faucets", "toilets", "water heaters"],
    "certifications": ["backflow certified"],
    "currentLocation": "Orem / Provo",
    "status": "on_job",
    "currentJobId": 4,
    "notes": "Reliable and fast. Good with routine jobs. Not ready for gas work or complex emergencies solo.",
    "metrics": {
      "avgCallbackRate": 0.05,
      "avgRating": 4.7,
      "emergencyResponseCount": 12
    }
  },
  {
    "id": "jake",
    "name": "Jake",
    "seniority": "mid",
    "years": 2,
    "specialties": ["drains", "faucets", "general maintenance", "water softeners"],
    "certifications": [],
    "currentLocation": "Pleasant Grove / Lindon",
    "status": "on_job",
    "currentJobId": 6,
    "notes": "Fastest drain clearer on the team. Still building customer skills. Don't send to first-time customers alone if avoidable.",
    "metrics": {
      "avgCallbackRate": 0.06,
      "avgRating": 4.5,
      "emergencyResponseCount": 5
    }
  },
  {
    "id": "danny",
    "name": "Danny",
    "seniority": "junior",
    "years": 0.5,
    "specialties": ["general maintenance", "faucets", "toilets"],
    "certifications": [],
    "currentLocation": "Spanish Fork / Springville",
    "status": "on_job",
    "currentJobId": 8,
    "notes": "Apprentice. Learning fast but needs supervision on anything complex. Great attitude. Customers like him but he's not ready for emergencies.",
    "metrics": {
      "avgCallbackRate": 0.08,
      "avgRating": 4.6,
      "emergencyResponseCount": 0
    }
  }
]
```

#### customers.json — Customer database with tiers and history

Include at least 10 customers spanning all three tiers:

**Tier 1 (VIP)** — 3+ years, multiple jobs, referral source:
- Garcia (since 2021-03, 12 jobs, referred 3 customers, always great)
- Chen (since 2020-06, 8 jobs, no complaints ever)
- Patterson (since 2022-01, 6 jobs, always pays on time)

**Tier 2 (Regular)** — 1-3 years, at least 2 jobs:
- Ramirez (since 2024-08, 2 jobs)
- Thorpe (since 2023-06, 3 jobs, flexible on timing)
- Park (since 2025-09, 2 jobs)

**Tier 3 (New)** — <1 year or first job:
- Johnson (since 2025-12, 1 job)
- Webber (prospective, never used Shamrock)

Include 2 additional customers for curveball scenarios:
- A customer with a complaint history pattern (2 prior complaints resolved with free callbacks, no underlying issue found) — for exploitation detection testing
- A long-time customer (4+ years) who recently had work done — for warranty/policy-flex testing

Each customer record must include: id, name, address, phone, customerSince, tier (1/2/3), lifetimeValue, jobCount, referralCount, notes, complaintHistory (array of past complaints with resolution), lastJobDate, lastJobType, communicationPreference ("call" | "text"), paymentHistory ("excellent" | "good" | "slow" | "disputed").

#### schedule.json — Monday 2026-03-16 schedule

8 jobs across 4 techs. The schedule must include **deliberate flex slots**: at least one open buffer slot per half-day (morning and afternoon) to absorb emergencies without cascading disruption.

Use the exact schedule from the build plan but add flex buffer entries:

```json
{
  "date": "2026-03-16",
  "jobs": [
    // ... 8 real jobs as specified in the build plan ...
  ],
  "flexSlots": [
    {
      "id": "flex-am",
      "tech": null,
      "time": "11:00",
      "duration_hrs": 1,
      "type": "FLEX_BUFFER",
      "status": "available",
      "notes": "Morning emergency buffer — held open by design"
    },
    {
      "id": "flex-pm",
      "tech": null,
      "time": "14:30",
      "duration_hrs": 1,
      "type": "FLEX_BUFFER",
      "status": "available",
      "notes": "Afternoon emergency buffer — held open by design"
    }
  ]
}
```

Each job entry includes: id, techId, time, durationHrs, type, customerId, address, status ("scheduled" | "in_progress" | "completed" | "rescheduled" | "paused" | "cancelled"), notes, bumpable (boolean).

#### jobs-catalog.json — Service catalog with pricing and requirements

```json
{
  "emergency": [
    { "type": "Pipe burst repair", "priceRange": [200, 500], "durationRange": [1, 3], "minSeniority": "mid", "requiredCerts": [] },
    { "type": "Gas leak diagnosis", "priceRange": [150, 300], "durationRange": [1, 2], "minSeniority": "senior", "requiredCerts": ["gas certified"] },
    { "type": "Sewage backup", "priceRange": [250, 600], "durationRange": [2, 4], "minSeniority": "mid", "requiredCerts": [] },
    { "type": "Water heater emergency", "priceRange": [200, 400], "durationRange": [1, 3], "minSeniority": "mid", "requiredCerts": [] },
    { "type": "Active flooding/ceiling leak", "priceRange": [200, 600], "durationRange": [1, 4], "minSeniority": "mid", "requiredCerts": [] }
  ],
  "routine": [
    { "type": "Drain clearing", "priceRange": [150, 250], "durationRange": [1, 2], "minSeniority": "any", "requiredCerts": [] },
    { "type": "Faucet repair", "priceRange": [100, 300], "durationRange": [1, 2], "minSeniority": "any", "requiredCerts": [] },
    { "type": "Toilet repair/replace", "priceRange": [150, 400], "durationRange": [1, 3], "minSeniority": "any", "requiredCerts": [] },
    { "type": "Water heater install", "priceRange": [800, 1500], "durationRange": [3, 5], "minSeniority": "senior", "requiredCerts": [] },
    { "type": "Water softener service", "priceRange": [100, 200], "durationRange": [1, 2], "minSeniority": "any", "requiredCerts": [] },
    { "type": "Consultation/quote", "priceRange": [0, 0], "durationRange": [0.5, 1], "minSeniority": "any", "requiredCerts": [] }
  ],
  "afterHoursSurcharge": 150
}
```

#### service-area.json — Drive time matrix

A simplified lookup of drive times (in minutes) between areas. Include: Lehi, American Fork, Orem, Provo, Pleasant Grove, Lindon, Spanish Fork, Springville, Saratoga Springs, Eagle Mountain.

Example entry: `{ "from": "Lehi", "to": "Orem", "minutes": 15 }`. Include all pairwise combinations relevant to the tech areas and the emergency scenario (the demo emergency address is in Saratoga Springs — "742 Lakeside Dr, Saratoga Springs").

#### policies.json — Business policies

```json
{
  "warranty": {
    "standardDays": 30,
    "description": "30-day workmanship warranty on all repairs"
  },
  "callbacks": {
    "withinWarranty": "no charge",
    "outsideWarranty": "standard diagnostic fee applies"
  },
  "afterHours": {
    "hours": "before 7am or after 6pm",
    "surcharge": 150
  },
  "cancellation": {
    "notice": "24 hours",
    "fee": 0,
    "lateCancel": "50% of estimated service cost"
  },
  "payment": {
    "terms": "due on completion",
    "methods": ["cash", "check", "card"],
    "netTermsForCommercial": 30
  },
  "emergencyResponse": {
    "guarantee": "same-day, no exceptions",
    "dispatchTarget": "within 30 minutes of call"
  }
}
```

### State Manager (src/state/state.ts)

A TypeScript module that:
1. Loads all JSON data files at startup into an in-memory store
2. Exposes typed read accessors: `getTechs()`, `getCustomers()`, `getSchedule()`, `getJobsCatalog()`, `getServiceArea()`, `getPolicies()`
3. Exposes mutation methods: `updateTechStatus(techId, status, currentJobId?)`, `updateJobStatus(jobId, status)`, `addJobToSchedule(job)`, `removeJobFromSchedule(jobId)`, `reassignJob(jobId, newTechId, newTime?)`, `consumeFlexSlot(slotId)`, `getFlexSlots()`
4. Exposes query helpers: `getTechById(id)`, `getCustomerById(id)`, `getJobsByTech(techId)`, `getUpcomingJobsByTech(techId)`, `getCustomerTier(customerId)`, `getDriveTime(from, to)`
5. Provides a `resetToDefault()` method that reloads from disk — used before demos to reset to clean Monday state
6. Provides a `getStateSnapshot()` method that returns a formatted string of current operational state suitable for injection into a system prompt

All types should be defined in `src/types.ts`.

## Files to Create

- `package.json` — project manifest with dependencies
- `tsconfig.json` — TypeScript configuration (strict mode, ESM)
- `.env.example` — environment variable template
- `.gitignore` — node_modules, .env, dist
- `src/types.ts` — TypeScript interfaces for all data structures
- `src/data/techs.json` — tech roster
- `src/data/customers.json` — customer database with tiers and complaint history
- `src/data/schedule.json` — Monday schedule with flex buffer slots
- `src/data/jobs-catalog.json` — service catalog
- `src/data/service-area.json` — drive time matrix
- `src/data/policies.json` — business policies
- `src/state/state.ts` — in-memory state manager
- `src/index.ts` — entry point (imports state, logs "Shamrock Plumbing agent starting...")
- `src/state/__tests__/state.test.ts` — unit tests for state manager

## Acceptance Criteria

- **Given** a fresh clone of the repository
  **When** the developer runs `npm install`
  **Then** all dependencies install without errors

- **Given** the project is set up
  **When** the developer runs `npx tsx src/index.ts`
  **Then** the process starts, loads all data files, and logs "Shamrock Plumbing agent starting..." without errors

- **Given** the state manager is initialized
  **When** `getTechs()` is called
  **Then** it returns an array of exactly 4 techs with ids "marcus", "tyler", "jake", "danny"

- **Given** the state manager is initialized
  **When** `getCustomers()` is called
  **Then** it returns at least 10 customers spanning all three tiers (tier 1, 2, 3)

- **Given** the state manager is initialized
  **When** `getSchedule()` is called
  **Then** it returns the Monday schedule with exactly 8 jobs and 2 flex buffer slots

- **Given** the state manager is initialized
  **When** `getFlexSlots()` is called
  **Then** it returns 2 slots — one morning (before noon) and one afternoon (after noon)

- **Given** a flex slot exists with status "available"
  **When** `consumeFlexSlot("flex-am")` is called
  **Then** that slot's status changes to "consumed" and subsequent calls to `getFlexSlots()` show only 1 available slot

- **Given** the state has been mutated (tech status changed, job reassigned)
  **When** `resetToDefault()` is called
  **Then** all state reverts to the original JSON data

- **Given** the state manager is initialized
  **When** `getStateSnapshot()` is called
  **Then** it returns a formatted string containing the current schedule, tech statuses, and pending jobs — suitable for embedding in a prompt

- **Given** the service area data is loaded
  **When** `getDriveTime("Lehi", "Saratoga Springs")` is called
  **Then** it returns a number representing estimated drive time in minutes

- **Given** a customer with id matching the complaint-history test customer
  **When** `getCustomerById(id)` is called
  **Then** the customer record includes a `complaintHistory` array with at least 2 prior complaints

- **Given** the test suite exists
  **When** `npx vitest run` is executed
  **Then** all state manager tests pass
