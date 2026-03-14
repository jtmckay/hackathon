---
routine: develop
status: complete
---
# 01: Foundation — Data Layer, NestJS API Server, and Telegram Bot

## Overview

Stand up the core application: a **NestJS** backend with SQLite (via Prisma), seed data for Shamrock Plumbing (techs, customers, schedule, job catalog, business policies), wire up the Claude API via the `@anthropic-ai/sdk` npm package with the system prompt containing Blake's intent statements, and connect two Telegram bot channels (Customer + Ops) using the open-source `nestjs-telegraf` package. This is the skeleton everything else builds on.

**Tech stack:** NestJS + Prisma + SQLite + `@anthropic-ai/sdk` + `nestjs-telegraf` (Telegraf) — all open-source.

**White-label note:** All business-specific data (company name, techs, customers, intent statements, pricing) must be loaded from configuration files — not hardcoded. A new shop should be able to swap in their own `config/` directory and have a working system.

## Current State (What's Done)

- [x] NestJS project scaffolded at `hackathon-bot/`
- [x] `nestjs-telegraf` installed and configured for **long polling** (no webhook needed)
- [x] `@nestjs/config` wired up with `.env` (`BOT_TOKEN`, `DATABASE_URL`)
- [x] Prisma initialized with SQLite (`prisma/schema.prisma`)
- [x] Initial migration applied — `User` and `Session` models created
- [x] `PrismaService` injectable with lifecycle hooks (`src/prisma.service.ts`)
- [x] Basic bot handler with `@Start`, `@Hears('ping')`, `@On('message')` (`src/app.update.ts`)
- [x] Project compiles and builds cleanly (`npm run build`)

## Remaining Work

- [ ] Install `@anthropic-ai/sdk`
- [ ] Expand Prisma schema with domain entities: `Tech`, `Customer`, `ScheduledJob`, `JobCatalog`, `JobLog`
- [ ] Create seed data JSON files under `config/` (techs, customers, schedule, job catalog, business rules, intent statements)
- [ ] Build `SeedService` to load JSON → Prisma (idempotent upsert on startup)
- [ ] Build `AgentService` wrapping Claude API via `@anthropic-ai/sdk`
- [ ] Build `SystemPromptBuilder` — assembles system prompt from live DB state + config
- [ ] Wire Telegram routing by chat ID (customer channel vs ops channel)
- [ ] Add `TelegramService` for posting to ops/customer channels
- [ ] Add `/schedule` and `/reset` bot commands
- [ ] Add `.env.example` with all required vars
- [ ] Validate config on startup with clear error messages

## Project Structure

```
hackathon-bot/
├── src/
│   ├── main.ts                     # NestJS bootstrap (port 3000)
│   ├── app.module.ts               # Root module (ConfigModule, TelegrafModule, providers)
│   ├── app.update.ts               # Bot message handler (nestjs-telegraf decorators)
│   ├── prisma.service.ts           # Injectable PrismaClient
│   ├── config/
│   │   ├── config.module.ts        # ConfigModule loading JSON + env
│   │   └── config.service.ts       # Typed access to business config
│   ├── database/
│   │   └── seed.service.ts         # Seed DB from JSON config files via Prisma
│   ├── agent/
│   │   ├── agent.module.ts
│   │   ├── agent.service.ts        # Claude API client via @anthropic-ai/sdk
│   │   └── system-prompt.builder.ts # Builds system prompt from live data
│   └── telegram/
│       ├── telegram.module.ts      # nestjs-telegraf integration
│       ├── telegram.update.ts      # Message handler (routes by chat ID)
│       └── telegram.service.ts     # Helper: post to ops/customer channels
├── config/
│   ├── business.json               # Company name, service area, policies
│   ├── intent-statements.json      # Blake's 10 intent statements
│   ├── techs.json                  # Tech roster
│   ├── customers.json              # Customer profiles with value tiers
│   ├── schedule.json               # Monday's 8-job schedule
│   └── job-catalog.json            # Service types, pricing, duration, skill reqs
├── prisma/
│   ├── schema.prisma               # SQLite schema (User, Session + domain models)
│   └── migrations/                 # Applied migrations
├── generated/prisma/               # Generated Prisma client
├── .env                            # BOT_TOKEN, DATABASE_URL
├── package.json
├── tsconfig.json
└── nest-cli.json
```

## Requirements

### Data Layer (Prisma + SQLite)
- Models: `Tech`, `Customer`, `ScheduledJob`, `JobCatalog`, `JobLog` (plus existing `User`, `Session`)
- `SeedService` runs on `onModuleInit` — loads JSON config files and upserts via Prisma (idempotent)
- `ScheduledJob` model tracks: id, techId, time, durationHrs, type, customerName, address, status (scheduled/in_progress/completed/paused/rescheduled), bumpable flag, notes
- Use the exact sample data from the build plan (4 techs, 8 jobs, customers with tiers)

### Claude API Integration
- Use `@anthropic-ai/sdk` (official Anthropic Node SDK)
- `SystemPromptBuilder` service assembles the system prompt from:
  - Business identity (company name, owner name, service area)
  - Intent statements (loaded from config)
  - Current schedule state (queried fresh from Prisma on each call)
  - Tech roster with current status
  - Customer database with value tiers
  - Job catalog with pricing
  - Current time context
- Use `claude-sonnet-4-6` model for fast responses
- Conversation history maintained per-channel (customer channel vs ops channel) in memory
- System prompt is rebuilt on every API call so schedule state is always current

### Telegram Bot (nestjs-telegraf)
- Use `nestjs-telegraf` (open-source NestJS wrapper for Telegraf)
- **Long polling mode** (no webhook, no ngrok needed)
- **Single unified group chat** by default (`GROUP_CHAT_ID`) — bot handles both customer and ops interactions in one place
- Feature flag `MULTI_CHANNEL_ENABLED=true` to split into separate customer/ops channels later
- Bot adapts tone per sender (warm for customers, data-driven for ops) in the unified chat
- On `/start`: post today's schedule to the group
- Bot commands: `/schedule` (post current schedule), `/reset` (reload seed data for demo)

### Configuration
- `.env` with: `BOT_TOKEN`, `DATABASE_URL`, `ANTHROPIC_API_KEY`, `GROUP_CHAT_ID`
- Feature flag: `MULTI_CHANNEL_ENABLED` (default `false`), with optional `CUSTOMER_CHANNEL_ID`, `OPS_CHANNEL_ID` when enabled
- `config/business.json` contains: companyName, ownerName, serviceArea, afterHoursStart, afterHoursEnd, afterHoursSurcharge, warrantyCallbackWindow
- NestJS `ConfigModule` validates env vars on startup
- All config JSON files validated on startup with clear error messages if missing/malformed

## Acceptance Criteria

- **Given** the project has no application code
  **When** `npm install` is run
  **Then** all dependencies install successfully including @nestjs/core, @prisma/client, @anthropic-ai/sdk, nestjs-telegraf, and telegraf

- **Given** valid `.env` and `config/` files exist
  **When** the app starts with `npm run start`
  **Then** SQLite database is created and seeded with 4 techs, 8+ customers, 8 scheduled jobs, and the job catalog

- **Given** the database is already seeded
  **When** the app restarts
  **Then** existing data is not duplicated (idempotent seed via upsert)

- **Given** `config/intent-statements.json` contains 10 intent statements
  **When** the system prompt is built
  **Then** all 10 intent statements appear in the prompt along with current schedule state, tech roster, and customer data

- **Given** a message is sent to the unified group chat
  **When** the bot receives it
  **Then** the bot responds using the Claude API with full dispatch context, adapting tone to the sender

- **Given** `MULTI_CHANNEL_ENABLED=true` and separate channel IDs are set
  **When** a message is sent to the customer or ops channel
  **Then** the bot routes to the appropriate conversation context with channel-specific prompting

- **Given** the bot is running
  **When** `/schedule` is sent in the group
  **Then** the bot posts the current day's schedule formatted with tech names, times, job types, customer names, and status

- **Given** the bot is running
  **When** `/reset` is sent in the group
  **Then** the database is re-seeded to the clean Monday morning state and a confirmation is posted

- **Given** `config/business.json` has `companyName: "Shamrock Plumbing"`
  **When** the bot responds in the customer channel
  **Then** the response references "Shamrock Plumbing" (loaded from config, not hardcoded)

- **Given** a required config file is missing
  **When** the app starts
  **Then** it exits with a clear error message naming the missing file
