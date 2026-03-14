import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = join(__dirname, '..', '..', '..', 'prompts', 'system-prompt.md');
const prompt = readFileSync(PROMPT_PATH, 'utf-8');

describe('Dispatch Decision Engine — System Prompt Sections', () => {
  it('contains Dispatch Decision Engine section', () => {
    expect(prompt).toContain('# Dispatch Decision Engine');
  });

  describe('Tech Evaluation Criteria', () => {
    it('contains tech evaluation criteria section', () => {
      expect(prompt).toContain('## Tech Evaluation Criteria');
    });

    it('includes skill match criterion', () => {
      expect(prompt).toContain('Skill match');
      expect(prompt).toContain('gas certified');
      expect(prompt).toContain('requiredCerts');
      expect(prompt).toContain('minSeniority');
    });

    it('includes availability/interruptibility criterion', () => {
      expect(prompt).toContain('Availability/interruptibility');
      expect(prompt).toContain('water heater install mid-way CANNOT be safely paused');
      expect(prompt).toContain('drain clearing CAN be paused');
      expect(prompt).toContain('consultation CAN be paused');
    });

    it('includes proximity criterion referencing drive time matrix', () => {
      expect(prompt).toContain('Proximity');
      expect(prompt).toContain('drive time matrix');
      expect(prompt).toContain('currentLocation');
      expect(prompt).toContain('actual minutes');
    });

    it('includes customer tier criterion with bump order', () => {
      expect(prompt).toContain('Current customer value');
      expect(prompt).toContain('bump Tier 3 first, Tier 2 second, Tier 1 last');
    });

    it('includes job bumpability criterion', () => {
      expect(prompt).toContain('Job bumpability');
      expect(prompt).toContain('bumpable: true');
      expect(prompt).toContain('Non-bumpable jobs');
    });

    it('includes seniority criterion — junior techs never dispatched alone', () => {
      expect(prompt).toContain('Junior techs');
      expect(prompt).toContain('Danny');
      expect(prompt).toContain('NEVER dispatched to emergencies alone');
      expect(prompt).toContain('escalate to Blake');
    });
  });

  describe('Intent Hierarchy', () => {
    it('contains intent hierarchy section', () => {
      expect(prompt).toContain('## Intent Hierarchy for Dispatch Selection');
    });

    it('lists elimination as first priority', () => {
      expect(prompt).toContain('Eliminate ineligible techs');
    });

    it('lists lower-tier preference', () => {
      expect(prompt).toContain('Prefer techs serving lower-tier customers');
      expect(prompt).toContain('Tier 3');
    });

    it('lists proximity preference with actual drive times', () => {
      expect(prompt).toContain('Prefer closer techs');
      expect(prompt).toContain('actual drive times');
    });

    it('lists seniority preference for complex emergencies', () => {
      expect(prompt).toContain('Prefer higher seniority for complex emergencies');
    });

    it('lists tiebreaker rule', () => {
      expect(prompt).toContain('Tiebreaker');
      expect(prompt).toContain('consultation > routine repair > complex job');
    });
  });

  describe('Dispatch Decision Post Format', () => {
    it('contains dispatch decision post section', () => {
      expect(prompt).toContain('## Dispatch Decision Post (Ops Group)');
    });

    it('includes the dispatch decision format with emoji', () => {
      expect(prompt).toContain('🔧 DISPATCH DECISION');
    });

    it('requires line-by-line evaluation of every tech', () => {
      expect(prompt).toContain('evaluate every tech');
      expect(prompt).toContain('✅ BEST OPTION');
      expect(prompt).toContain('❌ ELIMINATED');
      expect(prompt).toContain('⚠️ BACKUP');
    });

    it('includes displaced jobs listing', () => {
      expect(prompt).toContain('Displaced jobs');
      expect(prompt).toContain('needs rescheduling');
    });

    it('includes flex buffer tracking', () => {
      expect(prompt).toContain('Flex buffer');
    });

    it('includes awaiting confirmation note', () => {
      expect(prompt).toContain('Awaiting');
      expect(prompt).toContain('confirmation before notifying affected customers');
    });
  });

  describe('Dispatch Order Format', () => {
    it('contains dispatch order section', () => {
      expect(prompt).toContain('## Dispatch Order to Tech (Ops Group)');
    });

    it('includes dispatch order format with emoji', () => {
      expect(prompt).toContain('📋 DISPATCH ORDER');
    });

    it('includes required fields in dispatch order', () => {
      expect(prompt).toContain('EMERGENCY:');
      expect(prompt).toContain('Customer:');
      expect(prompt).toContain('Address:');
      expect(prompt).toContain('Issue:');
      expect(prompt).toContain('Customer notes:');
    });

    it('includes confirmation request in dispatch order', () => {
      expect(prompt).toContain('Please confirm you\'re heading there');
      expect(prompt).toContain('will NOT be notified until you confirm');
    });
  });

  describe('Tech Confirmation Gate', () => {
    it('contains confirmation gate section', () => {
      expect(prompt).toContain('## Tech Confirmation Gate');
    });

    it('explicitly states no ETAs before confirmation', () => {
      expect(prompt).toContain('must NOT notify displaced customers');
      expect(prompt).toContain('give the emergency customer a specific ETA until the dispatched tech has confirmed');
    });

    it('includes the pre-confirmation customer message', () => {
      expect(prompt).toContain('dispatching one of our senior technicians');
      expect(prompt).toContain('name and ETA for you shortly');
    });

    it('includes confirmation recognition examples', () => {
      expect(prompt).toContain('on my way');
      expect(prompt).toContain('heading there now');
      expect(prompt).toContain('leaving now');
      expect(prompt).toContain('omw');
    });

    it('requires confirmation from the right person', () => {
      expect(prompt).toContain('RIGHT person');
    });

    it('includes post-confirmation ops message format', () => {
      expect(prompt).toContain('confirmed — en route');
    });

    it('includes no-confirmation escalation', () => {
      expect(prompt).toContain('has not confirmed dispatch');
      expect(prompt).toContain('Blake — please advise');
      expect(prompt).toContain('NOT send speculative ETAs');
    });

    it('includes post-confirmation customer message with tech name and ETA', () => {
      expect(prompt).toContain('is on his way to you now');
      expect(prompt).toContain('should be there in about');
    });
  });

  describe('State Updates After Dispatch', () => {
    it('contains state updates section', () => {
      expect(prompt).toContain('## State Updates After Dispatch');
    });

    it('includes tech status update to en_route', () => {
      expect(prompt).toContain('"status": "en_route"');
    });

    it('includes current job pause update', () => {
      expect(prompt).toContain('"status": "paused"');
    });

    it('includes downstream job needs_rescheduling update', () => {
      expect(prompt).toContain('"status": "needs_rescheduling"');
    });

    it('includes add_emergency_job action', () => {
      expect(prompt).toContain('"action": "add_emergency_job"');
    });

    it('includes consume_flex_slot action', () => {
      expect(prompt).toContain('"action": "consume_flex_slot"');
    });

    it('specifies state updates happen after tech confirms', () => {
      expect(prompt).toContain('AFTER the tech confirms');
    });
  });

  describe('No-Tech-Available Escalation', () => {
    it('contains escalation section', () => {
      expect(prompt).toContain('## No-Tech-Available Escalation');
    });

    it('includes escalation alert format', () => {
      expect(prompt).toContain('🚨 ESCALATION REQUIRED');
      expect(prompt).toContain('No eligible tech available');
    });

    it('includes per-tech elimination reasoning', () => {
      expect(prompt).toContain('reason eliminated');
    });

    it('includes Danny junior note', () => {
      expect(prompt).toContain('Junior tech — cannot be dispatched to emergencies alone');
    });

    it('includes customer reassurance message', () => {
      expect(prompt).toContain('working on getting a technician to you as quickly as possible');
      expect(prompt).toContain("haven't forgotten about you");
    });

    it('prohibits making up ETAs or dispatching unqualified techs', () => {
      expect(prompt).toContain('NOT make up an ETA');
      expect(prompt).toContain('NOT dispatch an unqualified tech');
    });
  });

  describe('Data-driven reasoning instructions', () => {
    it('instructs agent to use actual data, not made-up numbers', () => {
      expect(prompt).toContain('Do NOT make up numbers');
      expect(prompt).toContain('actual data from the operational snapshot');
    });
  });
});
