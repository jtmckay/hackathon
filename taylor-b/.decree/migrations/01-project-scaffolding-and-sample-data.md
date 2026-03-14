---
routine: develop
---
# 01: Sample Data and Project Structure

## Overview

Create the complete sample data set and directory structure that powers every downstream migration. All data lives as JSON files on disk. State management is file-based — no TypeScript classes, no npm packages, no build step.

## Requirements

### Directory Structure

```
data/                    ← Canonical starting state (never mutated at runtime)
  techs.json
  customers.json
  schedule.json
  jobs-catalog.json
  service-area.json
  policies.json
state/                   ← Mutable runtime copies (reset from data/ for demos)
  techs.json
  customers.json
  schedule.json
  history-customer.json  ← Conversation history for customer group
  history-ops.json       ← Conversation history for ops group
prompts/
  system-prompt.md       ← Placeholder (built in migration 02)
scripts/
  reset.sh               ← Copies data/*.json → state/*.json, clears history
  snapshot.sh            ← Assembles current state into a text block for prompt injection
bridge/
  .env.example           ← Telegram credentials placeholder
```

### Reset Script (scripts/reset.sh)

Copies all canonical data files from `data/` to `state/`, and resets conversation history files to empty arrays:

```bash
#!/usr/bin/env bash
cp data/techs.json state/techs.json
cp data/customers.json state/customers.json
cp data/schedule.json state/schedule.json
echo '[]' > state/history-customer.json
echo '[]' > state/history-ops.json
echo "State reset to clean Monday morning defaults."
```

### State Snapshot Script (scripts/snapshot.sh)

Reads all state files and outputs a formatted text block suitable for injection into the system prompt. The output should include:

- Current date and simulated time
- Today's schedule (all jobs with status, tech, customer, time, bumpability)
- Flex buffer slot status (available/consumed)
- Tech roster with current status and location
- Any flags (consumed buffers, overbooked techs)

The output is plain text, not JSON — it should read naturally when embedded in a prompt.

### Environment Variables

Create `bridge/.env.example`:
```
TELEGRAM_BOT_TOKEN=
TELEGRAM_CUSTOMER_GROUP_ID=
TELEGRAM_OPS_GROUP_ID=
```

### Sample Data

All data lives in `data/` as JSON files. The state directory holds mutable copies that get updated at runtime.

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

8 jobs across 4 techs with **deliberate flex slots**: at least one open buffer slot per half-day (morning and afternoon) to absorb emergencies without cascading disruption.

```json
{
  "date": "2026-03-16",
  "jobs": [
    // ... 8 real jobs ...
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

### Conversation History Files

Initialize `state/history-customer.json` and `state/history-ops.json` as empty JSON arrays (`[]`). These will be appended to by the dispatch routine as messages are processed. Format:

```json
[
  { "role": "user", "content": "Water is pouring through my ceiling!", "sender": "Garcia", "timestamp": "2026-03-16T10:32:00" },
  { "role": "assistant", "content": "I hear you — let's get this handled...", "timestamp": "2026-03-16T10:32:05" }
]
```

## Files to Create

- `data/techs.json` — tech roster
- `data/customers.json` — customer database with tiers and complaint history
- `data/schedule.json` — Monday schedule with flex buffer slots
- `data/jobs-catalog.json` — service catalog
- `data/service-area.json` — drive time matrix
- `data/policies.json` — business policies
- `state/techs.json` — mutable copy of techs
- `state/customers.json` — mutable copy of customers
- `state/schedule.json` — mutable copy of schedule
- `state/history-customer.json` — empty array
- `state/history-ops.json` — empty array
- `scripts/reset.sh` — reset state to defaults
- `scripts/snapshot.sh` — assemble state into text for prompt injection
- `bridge/.env.example` — environment variable template
- `prompts/system-prompt.md` — placeholder (content in migration 02)

## Acceptance Criteria

- **Given** the data directory exists
  **When** `cat data/techs.json | jq length` is run
  **Then** it returns 4 (marcus, tyler, jake, danny)

- **Given** the data directory exists
  **When** `cat data/customers.json | jq length` is run
  **Then** it returns at least 10 customers spanning tiers 1, 2, and 3

- **Given** the data directory exists
  **When** `cat data/schedule.json | jq '.jobs | length'` is run
  **Then** it returns 8 jobs, plus `jq '.flexSlots | length'` returns 2

- **Given** the state has been modified
  **When** `scripts/reset.sh` is run
  **Then** all state files match their data/ counterparts and history files are empty arrays

- **Given** the state files are loaded
  **When** `scripts/snapshot.sh` is run
  **Then** it outputs a human-readable text block showing today's schedule, tech statuses, flex buffer status, and customer notes

- **Given** the service area data exists
  **When** `cat data/service-area.json | jq '.[] | select(.from=="Lehi" and .to=="Saratoga Springs") | .minutes'` is run
  **Then** it returns a number representing drive time in minutes

- **Given** the customer data exists
  **When** the complaint-history test customer is queried
  **Then** their record includes a `complaintHistory` array with at least 2 prior complaints

- **Given** a clean checkout
  **When** all JSON files are validated with `jq . < file.json`
  **Then** every file parses without errors
