import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDirectives } from '../src/agent/directives.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const STATE_DIR = join(ROOT, 'state');
const DATA_DIR = join(ROOT, 'data');
const PROMPT_PATH = join(ROOT, 'prompts', 'system-prompt.md');
const prompt = readFileSync(PROMPT_PATH, 'utf-8');

// --- State reset tests ---

let originalSchedule: string;
let originalTechs: string;
let originalCustomers: string;
let originalHistoryCustomer: string;
let originalHistoryOps: string;

beforeEach(() => {
  // Always restore from canonical data/ defaults to avoid corrupt state propagation
  originalSchedule = readFileSync(join(DATA_DIR, 'schedule.json'), 'utf-8');
  originalTechs = readFileSync(join(DATA_DIR, 'techs.json'), 'utf-8');
  originalCustomers = readFileSync(join(DATA_DIR, 'customers.json'), 'utf-8');
  originalHistoryCustomer = '[]';
  originalHistoryOps = '[]';
  writeFileSync(join(STATE_DIR, 'schedule.json'), originalSchedule, 'utf-8');
  writeFileSync(join(STATE_DIR, 'techs.json'), originalTechs, 'utf-8');
  writeFileSync(join(STATE_DIR, 'customers.json'), originalCustomers, 'utf-8');
  writeFileSync(join(STATE_DIR, 'history-customer.json'), originalHistoryCustomer, 'utf-8');
  writeFileSync(join(STATE_DIR, 'history-ops.json'), originalHistoryOps, 'utf-8');

  return () => {
    writeFileSync(join(STATE_DIR, 'schedule.json'), originalSchedule, 'utf-8');
    writeFileSync(join(STATE_DIR, 'techs.json'), originalTechs, 'utf-8');
    writeFileSync(join(STATE_DIR, 'customers.json'), originalCustomers, 'utf-8');
    writeFileSync(join(STATE_DIR, 'history-customer.json'), originalHistoryCustomer, 'utf-8');
    writeFileSync(join(STATE_DIR, 'history-ops.json'), originalHistoryOps, 'utf-8');
  };
});

describe('Scenario: /reset command — resetToDefault()', () => {
  it('resets state files to match data/ defaults', async () => {
    const { resetToDefault, getTechs, getSchedule, getCustomers } = await import(
      '../src/agent/state.js'
    );

    // Mutate state
    const techs = getTechs();
    techs[0].status = 'en_route';
    writeFileSync(join(STATE_DIR, 'techs.json'), JSON.stringify(techs, null, 2), 'utf-8');

    // Reset
    resetToDefault();

    // Verify techs match data/ originals
    const resetTechs = getTechs();
    const dataTechs = JSON.parse(readFileSync(join(ROOT, 'data', 'techs.json'), 'utf-8'));
    expect(resetTechs).toEqual(dataTechs);

    // Verify schedule matches
    const resetSchedule = getSchedule();
    const dataSchedule = JSON.parse(readFileSync(join(ROOT, 'data', 'schedule.json'), 'utf-8'));
    expect(resetSchedule).toEqual(dataSchedule);

    // Verify customers match
    const resetCustomers = getCustomers();
    const dataCustomers = JSON.parse(readFileSync(join(ROOT, 'data', 'customers.json'), 'utf-8'));
    expect(resetCustomers).toEqual(dataCustomers);
  });

  it('clears conversation histories on reset', async () => {
    const { resetToDefault, getHistory, appendHistory } = await import(
      '../src/agent/state.js'
    );

    // Add some history
    appendHistory('customer', [{ role: 'user', content: 'test' }]);
    appendHistory('ops', [{ role: 'user', content: 'test ops' }]);
    expect(getHistory('customer').length).toBeGreaterThan(0);
    expect(getHistory('ops').length).toBeGreaterThan(0);

    // Reset
    resetToDefault();

    // Histories should be empty
    expect(getHistory('customer')).toEqual([]);
    expect(getHistory('ops')).toEqual([]);
  });
});

// --- System prompt curveball coverage tests ---

describe('Scenario 1: Double emergency — system prompt guidance', () => {
  it('contains double emergency handling instructions', () => {
    expect(prompt).toContain('Double Emergency');
    expect(prompt).toContain('second emergency');
  });

  it('instructs to evaluate only remaining techs', () => {
    expect(prompt).toContain('UNAVAILABLE');
    expect(prompt).toContain('remaining techs');
  });

  it('instructs to show reduced pool reasoning', () => {
    expect(prompt).toContain('reduced pool');
  });
});

describe('Scenario 2: All techs busy — system prompt guidance', () => {
  it('contains all-techs-busy escalation guidance', () => {
    expect(prompt).toContain('All Techs Busy on Non-Interruptible Jobs');
  });

  it('instructs to escalate to Blake', () => {
    expect(prompt).toContain('All techs are on non-interruptible jobs');
    expect(prompt).toContain("need your call");
  });

  it('provides specific customer-facing language', () => {
    expect(prompt).toContain(
      "I'm working on getting someone to you",
    );
  });

  it('forbids fabricating an ETA', () => {
    expect(prompt).toContain('Do NOT fabricate an ETA');
  });

  it('forbids telling customer nobody is available', () => {
    expect(prompt).toContain('Do NOT tell the customer "nobody is available"');
  });
});

describe('Scenario 3: Hysterical customer — system prompt guidance', () => {
  it('contains panicked customer curveball guidance', () => {
    expect(prompt).toContain('Hysterical / Panicked Customer');
  });

  it('instructs to stay calm and not mirror panic', () => {
    expect(prompt).toContain('do NOT mirror their panic');
  });

  it('instructs to give one safety instruction first', () => {
    expect(prompt).toContain('ONE clear safety instruction FIRST');
  });

  it('instructs to validate feelings', () => {
    expect(prompt).toContain("I know this is scary");
  });

  it('forbids matching exclamation marks', () => {
    expect(prompt).toContain('do NOT respond with exclamation marks matching theirs');
  });
});

describe('Scenario 4: False emergency — system prompt guidance', () => {
  it('contains false emergency classification guidance', () => {
    expect(prompt).toContain('False Emergency');
    expect(prompt).toContain('Routine Issue Labeled "Emergency"');
  });

  it('instructs to classify as routine', () => {
    expect(prompt).toContain('Correctly classify as ROUTINE');
  });

  it('forbids triggering emergency dispatch', () => {
    expect(prompt).toContain('Do NOT trigger emergency dispatch');
  });

  it('forbids posting emergency alert', () => {
    expect(prompt).toContain('not an emergency alert');
  });
});

describe('Scenario 5: After-hours emergency — system prompt guidance', () => {
  it('contains after-hours emergency guidance', () => {
    expect(prompt).toContain('After-Hours Emergency');
  });

  it('specifies the $150 surcharge amount', () => {
    expect(prompt).toContain('$150 after-hours fee');
  });

  it('instructs transparent disclosure before dispatching', () => {
    expect(prompt).toContain('I want to be upfront about that');
  });

  it('instructs not to wait until morning', () => {
    expect(prompt).toContain('Do NOT wait until morning');
  });
});

describe('Scenario 6: VIP repeat customer emergency — system prompt guidance', () => {
  it('contains VIP customer emergency guidance', () => {
    expect(prompt).toContain('VIP / Repeat Customer Emergency');
  });

  it('instructs to recognize by name immediately', () => {
    expect(prompt).toContain('Recognize them IMMEDIATELY by name');
  });

  it('instructs to reference customer history', () => {
    expect(prompt).toContain('years as customer, referral count, loyalty');
  });

  it('instructs to dispatch best available tech', () => {
    expect(prompt).toContain('BEST available tech');
  });
});

describe('Scenario 7: Tech pushback — system prompt guidance', () => {
  it('contains tech pushback handling guidance', () => {
    expect(prompt).toContain('Tech Pushback After Dispatch');
  });

  it('instructs to acknowledge tech situation', () => {
    expect(prompt).toContain('do NOT override them blindly');
  });

  it('instructs to re-evaluate backup techs', () => {
    expect(prompt).toContain('backup tech available');
  });

  it('provides negotiation language', () => {
    expect(prompt).toContain('How long until you can safely pause');
  });

  it('instructs to post situation to ops', () => {
    expect(prompt).toContain("Post the situation to ops for Blake's awareness");
  });
});

describe('Scenario 8: Previous Shamrock job caused issue — system prompt guidance', () => {
  it('contains prior-work warranty curveball guidance', () => {
    expect(prompt).toContain('Previous Shamrock Job Caused the Issue');
  });

  it('instructs immediate acknowledgment without deflecting', () => {
    expect(prompt).toContain(
      "I can see we were out there recently — let me get this taken care of right away",
    );
  });

  it('forbids deflecting or asking for proof', () => {
    expect(prompt).toContain('Do NOT deflect, ask for proof');
  });

  it('instructs no-charge fix', () => {
    expect(prompt).toContain('NO CHARGE');
  });

  it('instructs to lean toward customer even when uncertain', () => {
    expect(prompt).toContain('even if you\'re not 100% sure');
  });
});

describe('Scenario 9: Customer asks about cost — system prompt guidance', () => {
  it('contains cost-during-emergency guidance', () => {
    expect(prompt).toContain('Customer Asks About Cost Mid-Emergency');
  });

  it('instructs to give a transparent price range', () => {
    expect(prompt).toContain('$200-600');
  });

  it('reinforces no-surprise cost policy', () => {
    expect(prompt).toContain('no surprises');
  });

  it('forbids dodging the cost question', () => {
    expect(prompt).toContain('Do NOT dodge the question');
  });
});

describe('Scenario 10: Review threat — system prompt guidance', () => {
  it('contains review threat handling guidance', () => {
    expect(prompt).toContain('Review Threat / Demand for Free Service');
  });

  it('forbids caving to threats', () => {
    expect(prompt).toContain('Do NOT cave to the threat');
  });

  it('forbids promising unkept timelines', () => {
    expect(prompt).toContain('Do NOT promise a timeline you can\'t keep');
  });

  it('provides warm but firm response language', () => {
    expect(prompt).toContain(
      'Let me give you an honest timeline rather than one I can\'t keep',
    );
  });

  it('instructs to flag to Blake', () => {
    expect(prompt).toContain('Flagging for your review');
  });
});

describe('Scenario 11: Tech calls in sick — system prompt guidance', () => {
  it('contains sick tech handling guidance', () => {
    expect(prompt).toContain('Tech Calls in Sick');
  });

  it('instructs to acknowledge with care', () => {
    expect(prompt).toContain("Take care of yourself");
    expect(prompt).toContain("I'll handle your remaining jobs");
  });

  it('instructs to identify all remaining jobs', () => {
    expect(prompt).toContain('ALL remaining jobs for that tech');
  });

  it('instructs cascade logic and tier-order handling', () => {
    expect(prompt).toContain('cascade logic');
    expect(prompt).toContain('tier order');
  });

  it('instructs to notify all affected customers', () => {
    expect(prompt).toContain('Notify ALL affected customers');
  });
});

describe('Scenario 12: Multiple simultaneous disruptions — system prompt guidance', () => {
  it('contains multi-disruption handling guidance', () => {
    expect(prompt).toContain('Multiple Simultaneous Disruptions');
  });

  it('specifies priority order', () => {
    expect(prompt).toContain('emergency FIRST, then sick tech cascade, then overrun');
  });

  it('instructs to keep disruption streams separate', () => {
    expect(prompt).toContain('do NOT confuse jobs or customers between them');
  });

  it('instructs consolidated schedule rebuild', () => {
    expect(prompt).toContain('ONE consolidated schedule rebuild');
  });

  it('instructs consolidated Blake briefing', () => {
    expect(prompt).toContain('MULTIPLE DISRUPTIONS');
    expect(prompt).toContain('Do NOT post separate briefings');
  });
});

describe('Curveball tuning log', () => {
  it('contains a tuning log section', () => {
    expect(prompt).toContain('Curveball Tuning Log');
  });
});

// --- Directive parsing for curveball-relevant patterns ---

describe('Directive parsing — escalation to Blake (all techs busy)', () => {
  it('correctly parses an escalation post to ops', () => {
    const input =
      "I'm working on getting a technician to you as quickly as possible. [POST_TO_OPS: 🚨 ESCALATION REQUIRED — No eligible tech available for emergency dispatch.\n\nAll senior/mid techs eliminated:\n• Marcus: Non-bumpable water heater install\n• Tyler: Non-bumpable drain job\n• Jake: Non-bumpable service\n• Danny: Junior tech — cannot be dispatched to emergencies alone\n\nBlake — need your call on this.]";
    const result = parseDirectives(input);

    expect(result.visibleText).toContain('getting a technician to you');
    expect(result.visibleText).not.toContain('ESCALATION');
    expect(result.opsMessages).toHaveLength(1);
    expect(result.opsMessages[0]).toContain('ESCALATION REQUIRED');
    expect(result.opsMessages[0]).toContain('need your call');
  });
});

describe('Directive parsing — review threat flag to ops', () => {
  it('correctly parses a review threat flag', () => {
    const input =
      "I hear you, and I know this is frustrating. I'm working on getting someone to you as fast as I can. Let me give you an honest timeline. [POST_TO_OPS: ⚠️ Customer Johnson threatening 1-star review. Offered standard service options. Staying warm but not caving. Flagging for your review.]";
    const result = parseDirectives(input);

    expect(result.visibleText).toContain('honest timeline');
    expect(result.visibleText).not.toContain('threatening');
    expect(result.opsMessages).toHaveLength(1);
    expect(result.opsMessages[0]).toContain('threatening 1-star review');
    expect(result.opsMessages[0]).toContain('Flagging for your review');
  });
});

describe('Directive parsing — warranty callback to ops', () => {
  it('correctly parses a warranty callback post', () => {
    const input =
      "I can see we were out there recently — let me get this taken care of right away. [POST_TO_OPS: 🔧 WARRANTY CALLBACK\n\nCustomer: Chen (Tier 1)\nRecent work: Water heater install on 2026-03-05\nCurrent issue: Ceiling leak near water heater\nConnection: plausible\n\nScheduling no-charge callback per Blake's \"own mistakes fast\" policy.]";
    const result = parseDirectives(input);

    expect(result.visibleText).toContain('get this taken care of');
    expect(result.opsMessages).toHaveLength(1);
    expect(result.opsMessages[0]).toContain('WARRANTY CALLBACK');
    expect(result.opsMessages[0]).toContain('no-charge callback');
  });
});

describe('Directive parsing — sick tech cascade', () => {
  it('correctly parses multiple state updates for sick tech reassignment', () => {
    const input =
      'Take care of yourself, Tyler. [UPDATE_STATE: {"action": "update_tech_status", "techId": "tyler", "status": "sick"}] [UPDATE_STATE: {"action": "reassign_job", "jobId": 5, "newTechId": "jake", "newTime": "13:00"}] [POST_TO_OPS: Tyler is sick — reassigning his afternoon jobs. Thorpe toilet repair moved to Jake at 1:00pm.] [POST_TO_CUSTOMER: Hi Mr. Thorpe, this is Shamrock Plumbing. We need to adjust your appointment today — Jake will be handling your toilet repair at 1:00pm instead of Tyler. Sorry for the change!]';
    const result = parseDirectives(input);

    expect(result.visibleText).toBe('Take care of yourself, Tyler.');
    expect(result.stateUpdates).toHaveLength(2);
    expect(result.stateUpdates[0].action).toBe('update_tech_status');
    expect(result.stateUpdates[0].status).toBe('sick');
    expect(result.stateUpdates[1].action).toBe('reassign_job');
    expect(result.stateUpdates[1].newTechId).toBe('jake');
    expect(result.opsMessages).toHaveLength(1);
    expect(result.customerMessages).toHaveLength(1);
    expect(result.customerMessages[0]).toContain('Thorpe');
  });
});

// --- Demo flow validation (structural) ---

describe('Demo flow — structural validation', () => {
  it('system prompt contains morning briefing format', () => {
    expect(prompt).toContain('Morning Schedule Briefing');
    expect(prompt).toContain('GOOD MORNING');
  });

  it('system prompt contains emergency intake flow', () => {
    expect(prompt).toContain('Emergency Intake & Qualification');
    expect(prompt).toContain('EMERGENCY INCOMING');
  });

  it('system prompt contains dispatch decision engine', () => {
    expect(prompt).toContain('Dispatch Decision Engine');
    expect(prompt).toContain('DISPATCH DECISION');
  });

  it('system prompt contains tech confirmation gate', () => {
    expect(prompt).toContain('Tech Confirmation Gate');
    expect(prompt).toContain('must NOT notify displaced customers');
  });

  it('system prompt contains cascade rebuild flow', () => {
    expect(prompt).toContain('Cascading Schedule Rebuild');
    expect(prompt).toContain('SCHEDULE UPDATE');
  });

  it('system prompt contains Blake briefing format', () => {
    expect(prompt).toContain('Blake Briefing');
    expect(prompt).toContain('WHAT HAPPENED');
    expect(prompt).toContain('WHAT I DID');
    expect(prompt).toContain('WHY');
    expect(prompt).toContain('RECOMMENDATION');
  });

  it('system prompt contains customer notification tiers', () => {
    expect(prompt).toContain('Tier 1 (VIP)');
    expect(prompt).toContain('Tier 2 (Regular)');
    expect(prompt).toContain('Tier 3 (New)');
  });

  it('system prompt contains state update directives', () => {
    expect(prompt).toContain('update_tech_status');
    expect(prompt).toContain('update_job_status');
    expect(prompt).toContain('consume_flex_slot');
    expect(prompt).toContain('add_emergency_job');
    expect(prompt).toContain('reassign_job');
    expect(prompt).toContain('reschedule_job');
    expect(prompt).toContain('complete_job');
  });
});
