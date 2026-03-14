import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const STATE_DIR = join(ROOT, 'state');
const DATA_DIR = join(ROOT, 'data');

let originalSchedule: string;
let originalTechs: string;
let originalCustomers: string;

beforeEach(() => {
  // Always restore from canonical data/ defaults to avoid corrupt state propagation
  originalSchedule = readFileSync(join(DATA_DIR, 'schedule.json'), 'utf-8');
  originalTechs = readFileSync(join(DATA_DIR, 'techs.json'), 'utf-8');
  originalCustomers = readFileSync(join(DATA_DIR, 'customers.json'), 'utf-8');
  writeFileSync(join(STATE_DIR, 'schedule.json'), originalSchedule, 'utf-8');
  writeFileSync(join(STATE_DIR, 'techs.json'), originalTechs, 'utf-8');
  writeFileSync(join(STATE_DIR, 'customers.json'), originalCustomers, 'utf-8');

  return () => {
    writeFileSync(join(STATE_DIR, 'schedule.json'), originalSchedule, 'utf-8');
    writeFileSync(join(STATE_DIR, 'techs.json'), originalTechs, 'utf-8');
    writeFileSync(join(STATE_DIR, 'customers.json'), originalCustomers, 'utf-8');
  };
});

describe('Morning Briefing', () => {
  it('includes greeting with day and date', async () => {
    const { buildMorningBriefing } = await import('../startup.js');
    const briefing = buildMorningBriefing();

    expect(briefing).toContain('☀️ GOOD MORNING');
    expect(briefing).toContain('2026');
  });

  it('lists all techs with their seniority', async () => {
    const { buildMorningBriefing } = await import('../startup.js');
    const briefing = buildMorningBriefing();

    expect(briefing).toContain('Marcus (Senior)');
    expect(briefing).toContain('Tyler (Mid)');
    expect(briefing).toContain('Jake (Mid)');
    expect(briefing).toContain('Danny (Junior)');
  });

  it('shows jobs with customer tier and bumpability', async () => {
    const { buildMorningBriefing } = await import('../startup.js');
    const briefing = buildMorningBriefing();

    // Garcia is Tier 1, water heater install is NOT bumpable
    expect(briefing).toContain('Water heater install for Garcia (Tier 1, NOT bumpable)');
    // Ramirez is Tier 2, drain clearing is bumpable
    expect(briefing).toContain('Drain clearing for Ramirez (Tier 2, bumpable)');
  });

  it('shows flex buffer status', async () => {
    const { buildMorningBriefing } = await import('../startup.js');
    const briefing = buildMorningBriefing();

    expect(briefing).toContain('FLEX BUFFERS:');
    expect(briefing).toContain('✅ Morning');
    expect(briefing).toContain('✅ Afternoon');
    expect(briefing).toContain('Available');
  });

  it('shows consumed flex buffers with ❌', async () => {
    // Consume morning buffer
    const schedule = JSON.parse(originalSchedule);
    schedule.flexSlots[0].status = 'consumed';
    schedule.flexSlots[0].notes = 'Used for emergency at 742 Lakeside';
    writeFileSync(join(STATE_DIR, 'schedule.json'), JSON.stringify(schedule, null, 2), 'utf-8');

    const { buildMorningBriefing } = await import('../startup.js');
    const briefing = buildMorningBriefing();

    expect(briefing).toContain('❌ Morning');
    expect(briefing).toContain('Consumed');
  });

  it('includes FLAGS section', async () => {
    const { buildMorningBriefing } = await import('../startup.js');
    const briefing = buildMorningBriefing();

    expect(briefing).toContain('⚠️ FLAGS:');
  });

  it('flags techs with light schedules', async () => {
    const { buildMorningBriefing } = await import('../startup.js');
    const briefing = buildMorningBriefing();

    // Danny has only 1 job (2h)
    expect(briefing).toContain('Danny has only 1 job');
  });

  it('includes CUSTOMER NOTES for VIPs', async () => {
    const { buildMorningBriefing } = await import('../startup.js');
    const briefing = buildMorningBriefing();

    expect(briefing).toContain('CUSTOMER NOTES:');
    // Garcia is Tier 1 and on today's schedule
    expect(briefing).toContain('Garcia (Tier 1)');
  });

  it('formats times in 12-hour format', async () => {
    const { buildMorningBriefing } = await import('../startup.js');
    const briefing = buildMorningBriefing();

    expect(briefing).toContain('8:00am');
    expect(briefing).toContain('12:00pm');
    expect(briefing).toContain('2:00pm');
  });
});

describe('Per-Tech Morning Schedule', () => {
  it('builds a personalized schedule for a specific tech', async () => {
    const { buildTechMorningSchedule } = await import('../startup.js');
    const { getSchedule, getTechs, getCustomers } = await import('../../agent/state.js');

    const schedule = getSchedule();
    const techs = getTechs();
    const customers = getCustomers();
    const marcus = techs.find((t) => t.id === 'marcus')!;

    const result = buildTechMorningSchedule(marcus, schedule, customers, 'Monday');

    expect(result).toContain('Good morning Marcus');
    expect(result).toContain('Monday');
    // Should contain Marcus's jobs but NOT other techs' jobs
    expect(result).toContain('Garcia');
    // Should not include strategic tier analysis
    expect(result).not.toContain('Tier 3');
    expect(result).not.toContain('bumpable');
  });

  it('shows VIP note for Tier 1 customers in a friendly way', async () => {
    const { buildTechMorningSchedule } = await import('../startup.js');
    const { getSchedule, getTechs, getCustomers } = await import('../../agent/state.js');

    const schedule = getSchedule();
    const techs = getTechs();
    const customers = getCustomers();
    const marcus = techs.find((t) => t.id === 'marcus')!;

    const result = buildTechMorningSchedule(marcus, schedule, customers, 'Monday');

    // Garcia is Tier 1 VIP
    expect(result).toContain('VIP customer');
  });

  it('shows job count and closing line', async () => {
    const { buildTechMorningSchedule } = await import('../startup.js');
    const { getSchedule, getTechs, getCustomers } = await import('../../agent/state.js');

    const schedule = getSchedule();
    const techs = getTechs();
    const customers = getCustomers();
    const marcus = techs.find((t) => t.id === 'marcus')!;

    const result = buildTechMorningSchedule(marcus, schedule, customers, 'Monday');

    expect(result).toContain('job');
    expect(result).toContain('Have a good one.');
  });
});
