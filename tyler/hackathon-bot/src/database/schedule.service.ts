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
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const emergencyJobId = `emerg-${Date.now()}`;

    const currentJob = await this.prisma.scheduledJob.findFirst({
      where: { techId, status: { in: ['scheduled', 'in_progress'] } },
      orderBy: { time: 'asc' },
    });

    let pausedJobId: string | undefined;
    if (currentJob) {
      await this.prisma.scheduledJob.update({
        where: { id: currentJob.id },
        data: { status: 'paused' },
      });
      pausedJobId = currentJob.id;
    }

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

    this.logger.log(`Emergency ${emergencyJobId} → ${techId}, paused: ${pausedJobId ?? 'none'}`);
    return { emergencyJobId, pausedJobId };
  }

  async markJobsDisplaced(jobIds: string[]): Promise<void> {
    if (!jobIds.length) return;
    await this.prisma.scheduledJob.updateMany({
      where: { id: { in: jobIds } },
      data: { status: 'needs_rescheduling' },
    });
    this.logger.log(`Displaced ${jobIds.length} jobs`);
  }

  async getDisplacedJobs(techId: string): Promise<any[]> {
    return this.prisma.scheduledJob.findMany({
      where: { techId, status: 'needs_rescheduling' },
      orderBy: { time: 'asc' },
    });
  }

  /** Reassign a displaced job to a different tech at a new time */
  async reassignJob(jobId: string, newTechId: string, newTime: string): Promise<void> {
    await this.prisma.scheduledJob.update({
      where: { id: jobId },
      data: { techId: newTechId, time: newTime, status: 'scheduled' },
    });
    this.logger.log(`Reassigned ${jobId} → ${newTechId} at ${newTime}`);
  }

  /** Mark a job as rescheduled (no same-day slot available) */
  async rescheduleJob(jobId: string, note?: string): Promise<void> {
    await this.prisma.scheduledJob.update({
      where: { id: jobId },
      data: {
        status: 'rescheduled',
        notes: note ?? 'Rescheduled — emergency displacement',
      },
    });
    this.logger.log(`Rescheduled ${jobId}`);
  }

  /** Mark all of a tech's remaining jobs as needs_rescheduling (sick/going home) */
  async markTechSick(techId: string): Promise<any[]> {
    const jobs = await this.prisma.scheduledJob.findMany({
      where: { techId, status: { in: ['scheduled', 'in_progress', 'paused'] } },
      orderBy: { time: 'asc' },
    });
    if (jobs.length) {
      await this.prisma.scheduledJob.updateMany({
        where: { id: { in: jobs.map(j => j.id) } },
        data: { status: 'needs_rescheduling' },
      });
    }
    this.logger.log(`Marked ${jobs.length} jobs needs_rescheduling for sick tech ${techId}`);
    return jobs;
  }

  /** Mark a job complete and log it */
  async completeJob(jobId: string, techId: string): Promise<void> {
    if (jobId) {
      await this.prisma.scheduledJob.updateMany({
        where: { id: jobId },
        data: { status: 'completed' },
      });
    } else {
      // Fall back to completing the first in_progress job for this tech
      await this.prisma.scheduledJob.updateMany({
        where: { techId, status: 'in_progress' },
        data: { status: 'completed' },
      });
    }
    await this.prisma.jobLog.create({
      data: { jobId: jobId || 'unknown', techId, action: 'completed', details: 'Tech reported job complete' },
    });
    this.logger.log(`Job ${jobId} completed by ${techId}`);
  }
}
