import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = join(__dirname, '..', '..', '..', 'prompts', 'system-prompt.md');
const prompt = readFileSync(PROMPT_PATH, 'utf-8');

describe('Cascading Schedule Rebuild — System Prompt Sections', () => {
  it('contains Cascading Schedule Rebuild section', () => {
    expect(prompt).toContain('# Cascading Schedule Rebuild');
  });

  it('requires cascade actions happen AFTER tech confirmation', () => {
    expect(prompt).toContain('AFTER the dispatched tech confirms');
    expect(prompt).toContain('tech confirmation gate');
  });

  describe('Displaced Job Handling', () => {
    it('contains displaced job handling section', () => {
      expect(prompt).toContain('## Displaced Job Handling');
    });

    it('specifies tier-order handling — Tier 1 first', () => {
      expect(prompt).toContain('tier order — Tier 1 customers first');
    });

    it('defines reassign as preferred option', () => {
      expect(prompt).toContain('### Reassign (Preferred)');
      expect(prompt).toContain('Has the skill/certification required');
      expect(prompt).toContain('Has an open slot at a compatible time');
    });

    it('defines reschedule as fallback', () => {
      expect(prompt).toContain('### Reschedule (Fallback)');
      expect(prompt).toContain('earliest available slot in the next 5 business days');
      expect(prompt).toContain('Higher-tier customers get the earliest slots');
    });

    it('includes decision tree', () => {
      expect(prompt).toContain('### Decision Tree');
      expect(prompt).toContain('Can another qualified tech take this job today');
    });
  });

  describe('Customer-Tier-Aware Notifications', () => {
    it('contains notification section', () => {
      expect(prompt).toContain('## Customer-Tier-Aware Notifications');
    });

    it('requires notifications differ by tier', () => {
      expect(prompt).toContain('tone and content MUST differ by tier');
    });

    it('includes Tier 1 VIP messaging guidance', () => {
      expect(prompt).toContain('### Tier 1 (VIP)');
      expect(prompt).toContain('Personal Apology + Priority Action');
      expect(prompt).toContain('references the relationship');
    });

    it('includes Tier 1 same-day failure messaging with extra apology', () => {
      expect(prompt).toContain('CANNOT be kept same-day');
      expect(prompt).toContain('extra apology');
    });

    it('includes Tier 2 regular messaging guidance', () => {
      expect(prompt).toContain('### Tier 2 (Regular)');
      expect(prompt).toContain('Warm + Solution-Oriented');
    });

    it('includes Tier 3 new customer messaging guidance', () => {
      expect(prompt).toContain('### Tier 3 (New)');
      expect(prompt).toContain('Professional + Brief');
    });

    it('prohibits sharing emergency details with customers', () => {
      expect(prompt).toContain('NEVER mention the emergency details, the other customer, or internal reasoning');
    });

    it('prohibits exposing tier classifications to customers', () => {
      expect(prompt).toContain('NEVER mention tier classifications, scheduling tradeoffs, or dispatch logic');
    });

    it('requires using actual customer data', () => {
      expect(prompt).toContain("customer's actual data");
      expect(prompt).toContain('not generic placeholders');
    });
  });

  describe('Schedule Rebuild Post', () => {
    it('contains schedule rebuild section', () => {
      expect(prompt).toContain('## Schedule Rebuild Post (Ops Group)');
    });

    it('includes schedule update format with emoji', () => {
      expect(prompt).toContain('📅 SCHEDULE UPDATE (post-emergency)');
    });

    it('includes flex status tracking', () => {
      expect(prompt).toContain('FLEX STATUS:');
      expect(prompt).toContain('Morning buffer:');
      expect(prompt).toContain('Afternoon buffer:');
    });

    it('includes displaced summary section', () => {
      expect(prompt).toContain('DISPLACED SUMMARY:');
    });

    it('includes status icons legend', () => {
      expect(prompt).toContain('✅ NOW: Active emergency');
      expect(prompt).toContain('➕ Reassigned job');
      expect(prompt).toContain('◻️ OPEN slot');
      expect(prompt).toContain('📅 Rescheduled to future date');
    });
  });

  describe('Blake Briefing', () => {
    it('contains Blake briefing section', () => {
      expect(prompt).toContain('## Blake Briefing');
    });

    it('includes briefing format with emoji', () => {
      expect(prompt).toContain('📋 BLAKE BRIEFING');
    });

    it('includes WHAT HAPPENED section', () => {
      expect(prompt).toContain('WHAT HAPPENED:');
    });

    it('includes WHAT I DID section', () => {
      expect(prompt).toContain('WHAT I DID:');
    });

    it('includes WHY section with data-driven reasoning', () => {
      expect(prompt).toContain('WHY:');
      expect(prompt).toContain('specific data');
      expect(prompt).toContain('customer tier, years as customer, drive times, job bumpability, referral count');
    });

    it('includes RECOMMENDATION section', () => {
      expect(prompt).toContain('RECOMMENDATION:');
      expect(prompt).toContain('recommendation for tomorrow');
    });

    it('requires flex buffer consumed note and recommendation', () => {
      expect(prompt).toContain('flex buffer was consumed');
      expect(prompt).toContain('recommend building one into tomorrow');
    });

    it('prohibits generic reasoning statements', () => {
      expect(prompt).toContain('not generic statements');
    });
  });

  describe('State Updates After Cascade', () => {
    it('contains cascade state updates section', () => {
      expect(prompt).toContain('## State Updates After Cascade');
    });

    it('includes reassign_job action', () => {
      expect(prompt).toContain('"action": "reassign_job"');
      expect(prompt).toContain('"newTechId"');
      expect(prompt).toContain('"newTime"');
    });

    it('includes reschedule_job action', () => {
      expect(prompt).toContain('"action": "reschedule_job"');
      expect(prompt).toContain('"newDate"');
    });
  });

  describe('End-to-End Emergency Flow', () => {
    it('contains end-to-end flow section', () => {
      expect(prompt).toContain('## End-to-End Emergency Flow');
    });

    it('lists all 8 steps of the complete flow', () => {
      expect(prompt).toContain('Emergency alert');
      expect(prompt).toContain('Tech evaluation');
      expect(prompt).toContain('Dispatch decision');
      expect(prompt).toContain('Tech confirmation');
      expect(prompt).toContain('Displaced job decisions');
      expect(prompt).toContain('Customer notifications');
      expect(prompt).toContain('Schedule rebuild');
      expect(prompt).toContain('Blake briefing');
    });

    it('requires continuous decision chain with no gaps', () => {
      expect(prompt).toContain('no gaps');
    });
  });

  describe('State Update Actions Documentation', () => {
    it('documents reassign_job in the action directives section', () => {
      expect(prompt).toContain('Reassign a job');
      expect(prompt).toContain('"action": "reassign_job"');
    });

    it('documents reschedule_job in the action directives section', () => {
      expect(prompt).toContain('Reschedule a job');
      expect(prompt).toContain('"action": "reschedule_job"');
    });
  });
});
