import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const STATE_DIR = join(ROOT, 'state');
const DATA_DIR = join(ROOT, 'data');

// We need to test applyStateUpdate with actual file I/O.
// Use the real state directory but save/restore its contents.

let originalSchedule: string;

beforeEach(() => {
  // Always restore from canonical data/ defaults to avoid corrupt state propagation
  originalSchedule = readFileSync(join(DATA_DIR, 'schedule.json'), 'utf-8');
  writeFileSync(join(STATE_DIR, 'schedule.json'), originalSchedule, 'utf-8');

  return () => {
    // Restore original state after each test
    writeFileSync(join(STATE_DIR, 'schedule.json'), originalSchedule, 'utf-8');
  };
});

describe('Cascade State Updates', () => {
  // Dynamic import to get the module fresh (it reads from disk)
  async function getModule() {
    // Clear the module from cache by using a unique import each time
    const mod = await import('../state.js');
    return mod;
  }

  describe('reassign_job action', () => {
    it('updates techId and time for a reassigned job', async () => {
      const { applyStateUpdate, getSchedule } = await getModule();

      const schedule = getSchedule();
      const targetJob = schedule.jobs[0];
      const originalTechId = targetJob.techId;
      const jobId = targetJob.id;

      applyStateUpdate({
        action: 'reassign_job',
        jobId,
        newTechId: 'tyler',
        newTime: '15:00',
      });

      const updated = getSchedule();
      const updatedJob = updated.jobs.find((j: { id: number | string }) => j.id === jobId);

      expect(updatedJob).toBeDefined();
      expect(updatedJob!.techId).toBe('tyler');
      expect(updatedJob!.time).toBe('15:00');
      expect(updatedJob!.status).toBe('reassigned');
    });

    it('preserves other job fields when reassigning', async () => {
      const { applyStateUpdate, getSchedule } = await getModule();

      const schedule = getSchedule();
      const targetJob = schedule.jobs[0];
      const jobId = targetJob.id;
      const originalType = targetJob.type;
      const originalAddress = targetJob.address;
      const originalCustomerId = targetJob.customerId;

      applyStateUpdate({
        action: 'reassign_job',
        jobId,
        newTechId: 'jake',
        newTime: '14:00',
      });

      const updated = getSchedule();
      const updatedJob = updated.jobs.find((j: { id: number | string }) => j.id === jobId);

      expect(updatedJob!.type).toBe(originalType);
      expect(updatedJob!.address).toBe(originalAddress);
      expect(updatedJob!.customerId).toBe(originalCustomerId);
    });
  });

  describe('reschedule_job action', () => {
    it('updates status to rescheduled and stores new date in notes', async () => {
      const { applyStateUpdate, getSchedule } = await getModule();

      const schedule = getSchedule();
      const targetJob = schedule.jobs[0];
      const jobId = targetJob.id;

      applyStateUpdate({
        action: 'reschedule_job',
        jobId,
        newDate: '2026-03-17',
        newTime: '13:00',
        newTechId: 'tyler',
      });

      const updated = getSchedule();
      const updatedJob = updated.jobs.find((j: { id: number | string }) => j.id === jobId);

      expect(updatedJob).toBeDefined();
      expect(updatedJob!.status).toBe('rescheduled');
      expect(updatedJob!.techId).toBe('tyler');
      expect(updatedJob!.time).toBe('13:00');
      expect(updatedJob!.notes).toContain('Rescheduled to 2026-03-17');
    });

    it('works without newTechId (keeps original tech)', async () => {
      const { applyStateUpdate, getSchedule } = await getModule();

      const schedule = getSchedule();
      const targetJob = schedule.jobs[0];
      const jobId = targetJob.id;
      const originalTechId = targetJob.techId;

      applyStateUpdate({
        action: 'reschedule_job',
        jobId,
        newDate: '2026-03-18',
        newTime: '10:00',
      });

      const updated = getSchedule();
      const updatedJob = updated.jobs.find((j: { id: number | string }) => j.id === jobId);

      expect(updatedJob!.status).toBe('rescheduled');
      expect(updatedJob!.techId).toBe(originalTechId);
      expect(updatedJob!.notes).toContain('2026-03-18');
    });
  });
});
