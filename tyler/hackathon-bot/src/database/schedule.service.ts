import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(private prisma: PrismaService) {}

  async assignEmergency(
    techId: string,
    emergency: { type: string; address: string; customerName: string; durationHrs: number; notes?: string },
  ): Promise<{ emergencyJobId: string; pausedJobId?: string }> {
    this.logger.log(`[assignEmergency] START — techId: ${techId}, customer: ${emergency.customerName}, address: ${emergency.address}`);

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const emergencyJobId = `emerg-${Date.now()}`;

    // Validate tech exists before doing anything
    const tech = await this.prisma.tech.findUnique({ where: { id: techId } });
    if (!tech) {
      this.logger.error(`[assignEmergency] Tech not found: "${techId}" — available IDs must be checked by caller`);
      throw new Error(`Tech not found: ${techId}`);
    }
    this.logger.log(`[assignEmergency] Tech confirmed: ${tech.name} (${tech.id}), status: ${tech.status}`);

    const currentJob = await this.prisma.scheduledJob.findFirst({
      where: { techId, status: { in: ['scheduled', 'in_progress'] } },
      orderBy: { time: 'asc' },
    });

    let pausedJobId: string | undefined;
    if (currentJob) {
      this.logger.log(`[assignEmergency] Pausing current job: ${currentJob.id} (${currentJob.type} @ ${currentJob.time})`);
      await this.prisma.scheduledJob.update({
        where: { id: currentJob.id },
        data: { status: 'paused' },
      });
      pausedJobId = currentJob.id;
    } else {
      this.logger.log(`[assignEmergency] No active job to pause for ${tech.name}`);
    }

    this.logger.log(`[assignEmergency] Creating emergency job: ${emergencyJobId} at ${timeStr}`);
    await this.prisma.scheduledJob.create({
      data: {
        id: emergencyJobId,
        techId,
        time: timeStr,
        durationHrs: emergency.durationHrs,
        type: emergency.type,
        customerName: emergency.customerName,
        address: emergency.address,
        status: 'in_progress',
        bumpable: false,
        priority: 1,
        notes: emergency.notes || 'EMERGENCY DISPATCH',
      },
    });

    this.logger.log(`[assignEmergency] Updating tech status → on_job, currentJobId: ${emergencyJobId}`);
    await this.prisma.tech.update({
      where: { id: techId },
      data: { currentJobId: emergencyJobId, status: 'on_job' },
    });

    this.logger.log(`[assignEmergency] COMPLETE — ${emergencyJobId} → ${techId}, paused: ${pausedJobId ?? 'none'}`);
    return { emergencyJobId, pausedJobId };
  }

  async markJobsDisplaced(jobIds: string[]): Promise<void> {
    if (!jobIds.length) {
      this.logger.log(`[markJobsDisplaced] No jobs to displace`);
      return;
    }
    this.logger.log(`[markJobsDisplaced] Displacing ${jobIds.length} jobs: ${jobIds.join(', ')}`);
    await this.prisma.scheduledJob.updateMany({
      where: { id: { in: jobIds } },
      data: { status: 'needs_rescheduling' },
    });
    this.logger.log(`[markJobsDisplaced] COMPLETE — ${jobIds.length} jobs marked needs_rescheduling`);
  }

  async getDisplacedJobs(techId: string): Promise<any[]> {
    const jobs = await this.prisma.scheduledJob.findMany({
      where: { techId, status: 'needs_rescheduling' },
      orderBy: { time: 'asc' },
    });
    this.logger.log(`[getDisplacedJobs] techId: ${techId} → ${jobs.length} displaced jobs`);
    return jobs;
  }

  /** Reassign a displaced job to a different tech at a new time */
  async reassignJob(jobId: string, newTechId: string, newTime: string): Promise<void> {
    this.logger.log(`[reassignJob] ${jobId} → techId: ${newTechId} at ${newTime}`);
    await this.prisma.scheduledJob.update({
      where: { id: jobId },
      data: { techId: newTechId, time: newTime, status: 'scheduled' },
    });
    this.logger.log(`[reassignJob] COMPLETE — ${jobId} reassigned`);
  }

  /** Mark a job as rescheduled (no same-day slot available) */
  async rescheduleJob(jobId: string, note?: string): Promise<void> {
    this.logger.log(`[rescheduleJob] ${jobId} — note: "${note ?? 'none'}"`);
    await this.prisma.scheduledJob.update({
      where: { id: jobId },
      data: {
        status: 'rescheduled',
        notes: note ?? 'Rescheduled — emergency displacement',
      },
    });
    this.logger.log(`[rescheduleJob] COMPLETE — ${jobId} rescheduled`);
  }

  /** Mark all of a tech's remaining jobs as needs_rescheduling (sick/going home) */
  async markTechSick(techId: string): Promise<any[]> {
    this.logger.log(`[markTechSick] techId: ${techId} — finding active jobs`);
    const jobs = await this.prisma.scheduledJob.findMany({
      where: { techId, status: { in: ['scheduled', 'in_progress', 'paused'] } },
      orderBy: { time: 'asc' },
    });
    this.logger.log(`[markTechSick] Found ${jobs.length} jobs to mark: ${jobs.map(j => j.id).join(', ')}`);
    if (jobs.length) {
      await this.prisma.scheduledJob.updateMany({
        where: { id: { in: jobs.map(j => j.id) } },
        data: { status: 'needs_rescheduling' },
      });
    }
    this.logger.log(`[markTechSick] COMPLETE — ${jobs.length} jobs marked needs_rescheduling for ${techId}`);
    return jobs;
  }

  /** Get jobs for a tech by first name (case-insensitive partial match on tech name) */
  async getJobsForTech(firstName: string): Promise<any[]> {
    const techs = await this.prisma.tech.findMany({
      where: { name: { contains: firstName } },
    });
    if (!techs.length) return [];
    const techId = techs[0].id;
    return this.prisma.scheduledJob.findMany({
      where: {
        techId,
        status: { notIn: ['completed', 'cancelled'] },
      },
      orderBy: { time: 'asc' },
    });
  }

  async getFirstAvailableTech(): Promise<{ id: string; name: string } | null> {
    const tech = await this.prisma.tech.findFirst({
      where: { status: 'available' },
      orderBy: { performanceRating: 'desc' },
      select: { id: true, name: true },
    });
    this.logger.log(`[getFirstAvailableTech] → ${tech ? `${tech.name} (${tech.id})` : 'NONE AVAILABLE'}`);
    return tech;
  }

  async completeJob(jobId: string, techId: string): Promise<void> {
    this.logger.log(`[completeJob] jobId: ${jobId}, techId: ${techId}`);
    await this.prisma.scheduledJob.update({
      where: { id: jobId },
      data: { status: 'completed' },
    });
    await this.prisma.tech.update({
      where: { id: techId },
      data: { currentJobId: null, status: 'available' },
    });
    await this.prisma.jobLog.create({
      data: { jobId, techId, action: 'completed', details: 'Tech reported job complete' },
    });
    this.logger.log(`[completeJob] COMPLETE — ${jobId} done, ${techId} now available`);
  }
}
