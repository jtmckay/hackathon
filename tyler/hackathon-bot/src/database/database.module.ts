import { Module, Global } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SeedService } from './seed.service';
import { ScheduleService } from './schedule.service';

@Global()
@Module({
  providers: [PrismaService, SeedService, ScheduleService],
  exports: [PrismaService, SeedService, ScheduleService],
})
export class DatabaseModule {}
