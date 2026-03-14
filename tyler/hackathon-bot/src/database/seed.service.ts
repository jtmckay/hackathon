import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BusinessConfigService } from '../config/config.service';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private prisma: PrismaService,
    private config: BusinessConfigService,
  ) {}

  async onModuleInit() {
    await this.seed();
  }

  async seed() {
    await this.seedTechs();
    await this.seedCustomers();
    await this.seedJobCatalog();
    await this.seedSchedule();
    this.logger.log('Database seeded successfully');
  }

  async resetAndSeed() {
    await this.prisma.jobLog.deleteMany();
    await this.prisma.scheduledJob.deleteMany();
    await this.prisma.tech.deleteMany();
    await this.prisma.customer.deleteMany();
    await this.prisma.jobCatalog.deleteMany();
    this.config.reload();
    await this.seed();
  }

  private async seedTechs() {
    for (const tech of this.config.techs) {
      await this.prisma.tech.upsert({
        where: { id: tech.id },
        update: {
          name: tech.name,
          phone: tech.phone,
          skills: JSON.stringify(tech.skills),
          certifications: JSON.stringify(tech.certifications),
          zone: tech.zone,
          status: tech.status || 'available',
          performanceRating: tech.performanceRating,
          avgJobTime: tech.avgJobTime,
          hourlyRate: tech.hourlyRate,
        },
        create: {
          id: tech.id,
          name: tech.name,
          phone: tech.phone,
          skills: JSON.stringify(tech.skills),
          certifications: JSON.stringify(tech.certifications),
          zone: tech.zone,
          status: tech.status || 'available',
          performanceRating: tech.performanceRating,
          avgJobTime: tech.avgJobTime,
          hourlyRate: tech.hourlyRate,
        },
      });
    }
    this.logger.log(`Seeded ${this.config.techs.length} techs`);
  }

  private async seedCustomers() {
    for (const cust of this.config.customers) {
      await this.prisma.customer.upsert({
        where: { id: cust.id },
        update: {
          name: cust.name,
          phone: cust.phone,
          email: cust.email || null,
          address: cust.address,
          zone: cust.zone,
          valueTier: cust.valueTier,
          lifetimeValue: cust.lifetimeValue,
          jobHistory: cust.jobHistory,
          paymentStatus: cust.paymentStatus,
          customerSince: cust.customerSince || '',
          notes: cust.notes || null,
        },
        create: {
          id: cust.id,
          name: cust.name,
          phone: cust.phone,
          email: cust.email || null,
          address: cust.address,
          zone: cust.zone,
          valueTier: cust.valueTier,
          lifetimeValue: cust.lifetimeValue,
          jobHistory: cust.jobHistory,
          paymentStatus: cust.paymentStatus,
          customerSince: cust.customerSince || '',
          notes: cust.notes || null,
        },
      });
    }
    this.logger.log(`Seeded ${this.config.customers.length} customers`);
  }

  private async seedJobCatalog() {
    for (const job of this.config.jobCatalog) {
      await this.prisma.jobCatalog.upsert({
        where: { id: job.id },
        update: {
          name: job.name,
          category: job.category,
          basePriceMin: job.basePriceMin,
          basePriceMax: job.basePriceMax,
          estimatedHours: job.estimatedHours,
          requiredSkills: JSON.stringify(job.requiredSkills),
          requiredCerts: JSON.stringify(job.requiredCerts),
          partsCommon: JSON.stringify(job.partsCommon),
          description: job.description || null,
        },
        create: {
          id: job.id,
          name: job.name,
          category: job.category,
          basePriceMin: job.basePriceMin,
          basePriceMax: job.basePriceMax,
          estimatedHours: job.estimatedHours,
          requiredSkills: JSON.stringify(job.requiredSkills),
          requiredCerts: JSON.stringify(job.requiredCerts),
          partsCommon: JSON.stringify(job.partsCommon),
          description: job.description || null,
        },
      });
    }
    this.logger.log(`Seeded ${this.config.jobCatalog.length} job catalog items`);
  }

  private async seedSchedule() {
    for (const job of this.config.schedule) {
      await this.prisma.scheduledJob.upsert({
        where: { id: job.id },
        update: {
          techId: job.techId,
          customerId: job.customerId || null,
          time: job.time,
          durationHrs: job.durationHrs,
          type: job.type,
          customerName: job.customerName,
          address: job.address,
          status: job.status || 'scheduled',
          bumpable: job.bumpable || false,
          priority: job.priority || 5,
          notes: job.notes || null,
        },
        create: {
          id: job.id,
          techId: job.techId,
          customerId: job.customerId || null,
          time: job.time,
          durationHrs: job.durationHrs,
          type: job.type,
          customerName: job.customerName,
          address: job.address,
          status: job.status || 'scheduled',
          bumpable: job.bumpable || false,
          priority: job.priority || 5,
          notes: job.notes || null,
        },
      });
    }
    this.logger.log(`Seeded ${this.config.schedule.length} scheduled jobs`);
  }
}
