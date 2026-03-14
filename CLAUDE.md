# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a hackathon project — an AI-powered dispatch and operations management system for **Shamrock Plumbing**. The agent IS the product: a conversational AI that autonomously handles customer intake, emergency triage, tech dispatch, cascading disruption recovery, and ops briefings.

**Status**: All 5 migrations complete. System is demo-ready.

## Actual Tech Stack (as built)

- **Bot framework**: NestJS + nestjs-telegraf (Telegram long polling)
- **AI engine**: Claude Sonnet 4.6 via `@anthropic-ai/sdk` with tool use
- **Database**: SQLite via Prisma ORM
- **Config**: JSON files in `tyler/hackathon-bot/config/`

## Working Directory

The bot lives in `tyler/hackathon-bot/`. All development happens there.

```bash
cd tyler/hackathon-bot
npm run start:dev   # start with file watching
npm run build       # compile check
```

## Key Files

```
src/
  agent/
    agent.service.ts         # Claude API calls, tool routing, conversation history
    system-prompt.builder.ts # Assembles full system prompt with live DB data
  telegram/
    telegram.update.ts       # Message handler — dedup, typing indicator, tool result execution
    telegram.service.ts      # Telegram send methods, ops alert formats
  database/
    schedule.service.ts      # DB mutations: assign/displace/reassign/complete jobs
    seed.service.ts          # Seeds and resets database from config JSON
config/
  business.json              # Company info, hours, policies, surcharge rates
  techs.json                 # Tech roster: skills, certs, zone, performance
  customers.json             # Customer database: tier, LTV, customerSince
  schedule.json              # Today's jobs
  job-catalog.json           # Service types, pricing, skill requirements
  drive-times.json           # Zone-to-zone drive time matrix (minutes)
  intent-statements.json     # Blake's 10 business principles
prisma/schema.prisma         # DB schema: Tech, Customer, ScheduledJob, Session, JobLog
```

## Claude Tools (in agent.service.ts)

The agent has 6 tools it can call:

| Tool | Fires when | Side effects |
|---|---|---|
| `post_emergency_alert` | Severity classified Critical/Urgent | Ops alert posted |
| `dispatch_tech` | Address confirmed + severity known | Schedule updated, ops decision + order posted |
| `escalate_to_blake` | All techs unavailable | Escalation posted to ops |
| `handle_cascade` | After dispatch OR sick tech | Jobs reassigned/rescheduled, notifications, rebuild posted |
| `complete_job` | Tech reports "job done" | Job marked complete, tech → available, customer follow-up |
| `flag_callback_alert` | Customer mentions recent Shamrock work | Callback alert posted to ops |

## Decree Workflow System

The `tyler/` directory uses [decree](https://github.com/shapeup-co/decree) for managing AI-driven development tasks.

Migrations live in `tyler/.decree/migrations/`. Completed migrations listed in `tyler/.decree/processed.md`.

## Channel Model (3 groups)

| Env var | ID | Behavior |
|---|---|---|
| `OPERATOR_GROUP_ID` | 5223707556 | Full ops access — all dispatch reasoning, schedule, briefings, `/reset`, `/schedule` |
| `CUSTOMER_GROUP_ID` | 5139115562 | Customer-facing — warm responses, no internal data, receives cascade notifications |
| `TECH_GROUP_ID` | -4970701789 | Tech-facing — job completion, sick reports, dispatch orders; limited tools |

Messages from any other chat ID are silently ignored.

Tools available by channel:
- Customer: `post_emergency_alert`, `dispatch_tech`, `escalate_to_blake`, `handle_cascade`, `complete_job`, `flag_callback`
- Operator: all tools (same as customer — full access for manual overrides)
- Tech: `handle_cascade`, `complete_job`, `flag_callback` only

Side-effect routing:
- Ops alerts → Operator
- Dispatch decisions + orders → Operator + Tech
- Customer notifications (cascade) → Customer
- Job follow-ups → Customer
- Schedule rebuilds + Blake briefings → Operator

## Demo Commands

- `/reset` — operator group only — wipe DB, re-seed from config, clear all state
- `/schedule` — operator and tech groups — show today's current schedule

## Important Behaviors

- **Dedup**: If a message arrives while one is being processed for the same chat, the second is dropped silently
- **Typing indicator**: Bot shows "typing..." for the full duration of Claude processing
- **No markdown**: All responses stripped of `**`, `#`, `_`, etc. before sending
- **Flow continuity**: Claude never resets context from a single "hi" or short message mid-flow
- **Job IDs in schedule**: System prompt includes `[job-id]` on every schedule line so Claude can reference them in tool calls
- **Tech currentJobId**: Updated live when emergency dispatched or job completed
- **After-hours**: Computed at prompt-build time — Claude knows definitively if it's after-hours
