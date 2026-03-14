import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

@Injectable()
export class BusinessConfigService implements OnModuleInit {
  private readonly logger = new Logger(BusinessConfigService.name);
  private readonly configDir = join(process.cwd(), 'config');

  business: any;
  intentStatements: string[];
  techs: any[];
  customers: any[];
  schedule: any[];
  jobCatalog: any[];

  onModuleInit() {
    this.loadAll();
  }

  private loadAll() {
    this.business = this.loadFile('business.json');
    this.intentStatements = this.loadFile('intent-statements.json').intentStatements;
    this.techs = this.loadFile('techs.json').techs;
    this.customers = this.loadFile('customers.json').customers;
    this.schedule = this.loadFile('schedule.json').schedule;
    this.jobCatalog = this.loadFile('job-catalog.json').jobCatalog;

    this.logger.log(`Loaded config: ${this.techs.length} techs, ${this.customers.length} customers, ${this.schedule.length} jobs, ${this.jobCatalog.length} catalog items`);
  }

  private loadFile(filename: string): any {
    const path = join(this.configDir, filename);
    if (!existsSync(path)) {
      throw new Error(`Required config file missing: config/${filename}`);
    }
    try {
      return JSON.parse(readFileSync(path, 'utf-8'));
    } catch (e) {
      throw new Error(`Failed to parse config/${filename}: ${e.message}`);
    }
  }

  reload() {
    this.loadAll();
  }
}
