# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a hackathon project to build an AI-powered dispatch and operations management system for **Shamrock Plumbing**. The agent IS the product — a conversational AI that autonomously handles customer intake, scheduling, dispatch, and disruption recovery.

**Target build time**: 6 hours
- Hours 0–2: Data setup and core agent loop
- Hours 2–5: Two bulletproofed workflows + edge cases
- Hours 5–6: Demo polish and stress testing

## Planned Tech Stack

- **Frontend**: React (chat UI + side panel showing schedule state)
- **Backend**: FastAPI or Node.js
- **AI Engine**: Claude API (business rules injected into system prompt)
- **Storage**: SQLite or in-memory JSON

## Two Core Workflows to Build

1. **Customer Intake → Dispatch**: Customer describes plumbing issue → triage → schedule check → tech selection (skill + proximity) → booking → confirmations
2. **Disruption Recovery**: Sick tech / overrun job / emergency → rebuild schedule → tradeoff decisions → notify affected parties → brief ops manager

## Decree Workflow System

The `taylor/` directory contains a [decree](https://github.com/shapeup-co/decree) automation framework for managing AI-driven development tasks.

```bash
# Run a task through decree (from taylor/ directory)
# Place task in taylor/.decree/inbox/message.md, then decree picks it up

# Manual AI invocation (as configured in config.yml)
claude -p "{prompt}"
```

Routines live in `taylor/.decree/routines/`. The default routine is `develop.sh`. A `rust-develop.sh` routine is also available if the backend uses Rust.

Decree lifecycle hooks:
- **beforeEach**: `git-baseline.sh` — saves current git state
- **afterEach**: `git-stash-changes.sh` — checkpoints routine output

## Key Design Documents

All in `figma/`:
- `dispatcher.md` — Core architecture and the two primary workflows
- `emergency-triage.md` — 6-phase emergency response flow (intake → find tech → dispatch → cascade → recover → learn)
- `roster.md` — Data structures for techs, customers, schedule, job catalog, service area, parts, and policies
- `note.md` — Feature scope summary

## Agent Architecture

The dispatcher agent is intent-driven: business rules ("Blake's intent statements") are injected into the system prompt alongside live operational data. The agent reasons over this context to make autonomous decisions — no hardcoded routing logic.

Data the agent needs at runtime:
- Tech roster (skills, certifications, location, status, performance metrics)
- Customer database (history, lifetime value, preferences, payment status)
- Current schedule
- Job catalog (service types, pricing, duration, skill requirements)
- Service area drive-time estimates
- Communication templates (matching Blake's voice/tone)
- Business policies (after-hours rates, warranties, callbacks)
