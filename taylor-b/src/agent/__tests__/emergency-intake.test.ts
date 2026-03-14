import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = join(__dirname, '..', '..', '..', 'prompts', 'system-prompt.md');
const prompt = readFileSync(PROMPT_PATH, 'utf-8');

describe('Emergency Intake — System Prompt Sections', () => {
  it('contains Emergency Intake & Qualification section', () => {
    expect(prompt).toContain('# Emergency Intake & Qualification');
  });

  it('contains Customer Recognition section', () => {
    expect(prompt).toContain('# Customer Recognition');
  });

  it('contains urgency detection guidance with critical/urgent/routine signals', () => {
    expect(prompt).toContain('## Urgency Detection');
    expect(prompt).toContain('Critical signals');
    expect(prompt).toContain('Urgent signals');
    expect(prompt).toContain('Routine signals');
  });

  it('contains severity classification levels', () => {
    expect(prompt).toContain('## Severity Classification');
    expect(prompt).toContain('CRITICAL');
    expect(prompt).toContain('URGENT');
    expect(prompt).toContain('ROUTINE');
  });

  it('contains safety response protocol with gas/electrical/flooding instructions', () => {
    expect(prompt).toContain('## Safety Response Protocol');
    expect(prompt).toContain('Gas Smell');
    expect(prompt).toContain('Electrical Risk Near Water');
    expect(prompt).toContain('Active Flooding');
  });

  it('includes gas evacuation instructions', () => {
    expect(prompt).toContain('Get everyone out of the house');
    expect(prompt).toContain('Call 911');
  });

  it('includes water main shutoff instructions', () => {
    expect(prompt).toContain('main shutoff valve');
    expect(prompt).toContain('Turn it clockwise');
  });

  it('includes electrical safety instructions', () => {
    expect(prompt).toContain('Stay away from the water');
    expect(prompt).toContain('shut off the breaker');
  });

  it('contains qualifying questions guidance', () => {
    expect(prompt).toContain('## Qualifying Questions');
    expect(prompt).toContain('NOT as a checklist');
  });

  it('limits follow-up questions for critical situations', () => {
    expect(prompt).toContain('2-3 questions');
  });

  it('contains emergency alert format with POST_TO_OPS directive', () => {
    expect(prompt).toContain('EMERGENCY INCOMING');
    expect(prompt).toContain('[POST_TO_OPS:');
    expect(prompt).toContain('Severity: CRITICAL');
  });

  it('contains urgent alert format', () => {
    expect(prompt).toContain('URGENT SERVICE REQUEST');
    expect(prompt).toContain('Same-day dispatch');
  });

  it('contains routine log note format', () => {
    expect(prompt).toContain('New service request');
  });

  it('contains warranty/prior-work flag guidance', () => {
    expect(prompt).toContain('POTENTIAL WARRANTY');
    expect(prompt).toContain('recent Shamrock work');
  });

  it('instructs not to expose ops reasoning to customers', () => {
    expect(prompt).toContain('NEVER expose internal reasoning');
  });

  it('contains customer recognition for known customers', () => {
    expect(prompt).toContain('Known customer');
    expect(prompt).toContain('greet them by name');
    expect(prompt).toContain('confirm their address');
  });

  it('contains unknown customer handling', () => {
    expect(prompt).toContain('Unknown sender');
    expect(prompt).toContain('Help first, details second');
  });

  it('contains panicked customer guidance', () => {
    expect(prompt).toContain('Panicked Customers');
    expect(prompt).toContain('calm and reassuring');
    expect(prompt).toContain('Do NOT mirror their panic');
  });

  it('contains multiple-issue prioritization guidance', () => {
    expect(prompt).toContain('Multiple issues');
    expect(prompt).toContain('highest-severity issue');
  });

  it('contains non-emergency routine handling', () => {
    expect(prompt).toContain('Non-Emergency (Routine) Handling');
    expect(prompt).toContain('NOT trigger emergency flow');
  });

  it('contains non-technical term recognition guidance', () => {
    expect(prompt).toContain('brown stuff coming up in my shower');
    expect(prompt).toContain('rotten eggs');
  });
});
