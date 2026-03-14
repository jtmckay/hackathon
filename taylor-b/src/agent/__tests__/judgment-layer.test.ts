import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDirectives } from '../directives.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const STATE_DIR = join(ROOT, 'state');
const DATA_DIR = join(ROOT, 'data');

let originalSchedule: string;
let originalTechs: string;

beforeEach(() => {
  // Always restore from canonical data/ defaults to avoid corrupt state propagation
  originalSchedule = readFileSync(join(DATA_DIR, 'schedule.json'), 'utf-8');
  originalTechs = readFileSync(join(DATA_DIR, 'techs.json'), 'utf-8');
  writeFileSync(join(STATE_DIR, 'schedule.json'), originalSchedule, 'utf-8');
  writeFileSync(join(STATE_DIR, 'techs.json'), originalTechs, 'utf-8');

  return () => {
    writeFileSync(join(STATE_DIR, 'schedule.json'), originalSchedule, 'utf-8');
    writeFileSync(join(STATE_DIR, 'techs.json'), originalTechs, 'utf-8');
  };
});

async function getModule() {
  return await import('../state.js');
}

describe('complete_job state action', () => {
  it('sets tech status to available and clears currentJobId', async () => {
    const { applyStateUpdate, getTechs } = await getModule();

    applyStateUpdate({
      action: 'complete_job',
      techId: 'marcus',
      jobId: 1,
    });

    const techs = getTechs();
    const marcus = techs.find((t) => t.id === 'marcus');
    expect(marcus).toBeDefined();
    expect(marcus!.status).toBe('available');
    expect(marcus!.currentJobId).toBeNull();
  });

  it('sets job status to completed', async () => {
    const { applyStateUpdate, getSchedule } = await getModule();

    applyStateUpdate({
      action: 'complete_job',
      techId: 'marcus',
      jobId: 1,
    });

    const schedule = getSchedule();
    const job = schedule.jobs.find((j) => j.id === 1);
    expect(job).toBeDefined();
    expect(job!.status).toBe('completed');
  });

  it('handles string jobId matching numeric id', async () => {
    const { applyStateUpdate, getSchedule } = await getModule();

    applyStateUpdate({
      action: 'complete_job',
      techId: 'tyler',
      jobId: '4',
    });

    const schedule = getSchedule();
    const job = schedule.jobs.find((j) => j.id === 4);
    expect(job).toBeDefined();
    expect(job!.status).toBe('completed');
  });

  it('updates both tech and schedule atomically', async () => {
    const { applyStateUpdate, getTechs, getSchedule } = await getModule();

    applyStateUpdate({
      action: 'complete_job',
      techId: 'jake',
      jobId: 6,
    });

    const techs = getTechs();
    const jake = techs.find((t) => t.id === 'jake');
    expect(jake!.status).toBe('available');
    expect(jake!.currentJobId).toBeNull();

    const schedule = getSchedule();
    const job = schedule.jobs.find((j) => j.id === 6);
    expect(job!.status).toBe('completed');
  });

  it('does not crash when techId is not found', async () => {
    const { applyStateUpdate, getSchedule } = await getModule();

    // Should not throw
    applyStateUpdate({
      action: 'complete_job',
      techId: 'nonexistent',
      jobId: 1,
    });

    // Job should still be updated
    const schedule = getSchedule();
    const job = schedule.jobs.find((j) => j.id === 1);
    expect(job!.status).toBe('completed');
  });
});

describe('Job completion directive parsing', () => {
  it('parses a complete_job UPDATE_STATE directive', () => {
    const input =
      'Job done. [UPDATE_STATE: {"action": "complete_job", "techId": "marcus", "jobId": "emergency-1"}] [POST_TO_OPS: ✅ Active flooding repair at 742 Lakeside Dr completed by Marcus. Marcus is now available.] [POST_TO_CUSTOMER: Hi Mrs. Webber, Marcus has wrapped up at your place. How did everything go? Is the leak fully resolved?]';
    const result = parseDirectives(input);

    expect(result.visibleText).toBe('Job done.');
    expect(result.stateUpdates).toHaveLength(1);
    expect(result.stateUpdates[0].action).toBe('complete_job');
    expect(result.stateUpdates[0].techId).toBe('marcus');
    expect(result.stateUpdates[0].jobId).toBe('emergency-1');
    expect(result.opsMessages).toHaveLength(1);
    expect(result.opsMessages[0]).toContain('completed by Marcus');
    expect(result.customerMessages).toHaveLength(1);
    expect(result.customerMessages[0]).toContain('Marcus has wrapped up');
  });
});

describe('Policy flex directive parsing', () => {
  it('parses policy flex ops post with all four conditions', () => {
    const input =
      'I can see we recently installed your water heater. Let me get a tech out to take a look at that noise — no charge. [POST_TO_OPS: 🤝 POLICY FLEX DECISION\n\nCustomer: Chen (Tier 1)\nAction: No-charge callback for water heater noise\n\nConditions met:\n✅ Loyalty: 5+ years, 8 jobs, 1 referral\n✅ Connection: Water heater installed 2026-03-05\n✅ Proportionate: Callback for noise on recent install\n✅ No pattern: Zero complaints in history\n\nDecision made per Blake\'s policy flex guidelines. No escalation needed.]';
    const result = parseDirectives(input);

    expect(result.opsMessages).toHaveLength(1);
    expect(result.opsMessages[0]).toContain('POLICY FLEX DECISION');
    expect(result.opsMessages[0]).toContain('Loyalty');
    expect(result.opsMessages[0]).toContain('Connection');
    expect(result.opsMessages[0]).toContain('Proportionate');
    expect(result.opsMessages[0]).toContain('No pattern');
    expect(result.opsMessages[0]).toContain('No escalation needed');
  });
});

describe('Exploitation pattern directive parsing', () => {
  it('parses pattern flag ops post', () => {
    const input =
      "I understand the frustration. I'd like to get to the bottom of this for you. I can schedule a diagnostic visit at our standard rate. [POST_TO_OPS: ⚠️ Pattern flag: Nelson requesting free callback. 2 prior complaints resolved with free service, no issue found. Offered paid diagnostic. Blake — flagging for your awareness.]";
    const result = parseDirectives(input);

    expect(result.opsMessages).toHaveLength(1);
    expect(result.opsMessages[0]).toContain('Pattern flag');
    expect(result.opsMessages[0]).toContain('2 prior complaints');
    expect(result.opsMessages[0]).toContain('paid diagnostic');
    expect(result.visibleText).not.toContain('Pattern flag');
  });

  it('parses threat-based demand flag', () => {
    const input =
      "I hear you, and I definitely want to make sure you're taken care of. Let me look at what's going on. [POST_TO_OPS: ⚠️ Customer Nelson leading with review threat. Offered standard service options. Flagging for your review.]";
    const result = parseDirectives(input);

    expect(result.opsMessages).toHaveLength(1);
    expect(result.opsMessages[0]).toContain('review threat');
    expect(result.visibleText).not.toContain('review threat');
  });
});
