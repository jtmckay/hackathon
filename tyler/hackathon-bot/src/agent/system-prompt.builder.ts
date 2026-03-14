import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BusinessConfigService } from '../config/config.service';

@Injectable()
export class SystemPromptBuilder {
  constructor(
    private prisma: PrismaService,
    private config: BusinessConfigService,
  ) {}

  async build(channel: 'customer' | 'ops'): Promise<string> {
    const [techs, customers, schedule, jobCatalog] = await Promise.all([
      this.prisma.tech.findMany(),
      this.prisma.customer.findMany(),
      this.prisma.scheduledJob.findMany({ include: { tech: true } }),
      this.prisma.jobCatalog.findMany(),
    ]);

    const biz = this.config.business;
    const now = new Date();

    const sections: string[] = [];

    // Identity
    sections.push(`# You are the AI dispatcher for ${biz.companyName}
Owner: ${biz.ownerName}
Phone: ${biz.phone}
Service Area: ${biz.serviceArea}
Current Time: ${now.toLocaleString()}

You manage scheduling, dispatch, and customer communications. You make autonomous decisions aligned with Blake's intent.`);

    // Intent statements
    sections.push(`# Blake's Intent Statements (Your Decision Framework)
${this.config.intentStatements.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);

    // Business policies
    sections.push(`# Business Policies
- After-hours: ${biz.afterHoursStart}–${biz.afterHoursEnd} (${biz.afterHoursSurcharge}x surcharge)
- Warranty callbacks: ${biz.warrantyCallbackWindow}
- Emergency response target: ${biz.emergencyResponseTarget}
- Cancellation: ${biz.cancellationPolicy}
- Payment: ${biz.paymentTerms}`);

    // Tech roster
    sections.push(`# Tech Roster (${techs.length} technicians)
${techs.map(t => `- **${t.name}** (${t.id}) | Zone: ${t.zone} | Status: ${t.status}${t.currentJobId ? ` (on ${t.currentJobId})` : ''} | Skills: ${JSON.parse(t.skills).join(', ')} | Certs: ${JSON.parse(t.certifications).join(', ')} | Rating: ${t.performanceRating} | Speed: ${t.avgJobTime}x | Rate: $${t.hourlyRate}/hr`).join('\n')}`);

    // Customer database
    sections.push(`# Customer Database (${customers.length} customers)
${customers.map(c => `- **${c.name}** (${c.id}) | ${c.address} | Zone: ${c.zone} | Tier: ${c.valueTier.toUpperCase()} | LTV: $${c.lifetimeValue} | Jobs: ${c.jobHistory} | Payment: ${c.paymentStatus}${c.notes ? ` | Notes: ${c.notes}` : ''}`).join('\n')}`);

    // Current schedule
    const grouped = {};
    for (const job of schedule) {
      const techName = job.tech.name;
      if (!grouped[techName]) grouped[techName] = [];
      grouped[techName].push(job);
    }
    const scheduleLines: string[] = [];
    for (const [techName, jobs] of Object.entries(grouped)) {
      scheduleLines.push(`\n**${techName}:**`);
      for (const job of (jobs as any[]).sort((a, b) => a.time.localeCompare(b.time))) {
        scheduleLines.push(`  ${job.time} - ${job.type} @ ${job.address} (${job.customerName}) [${job.status}]${job.bumpable ? ' [BUMPABLE]' : ''} Priority: ${job.priority}`);
      }
    }
    sections.push(`# Today's Schedule${scheduleLines.join('\n')}`);

    // Job catalog
    sections.push(`# Job Catalog
${jobCatalog.map(j => `- **${j.name}** (${j.id}) | ${j.category} | $${j.basePriceMin}–$${j.basePriceMax} | ~${j.estimatedHours}hrs | Skills: ${JSON.parse(j.requiredSkills).join(', ')}${JSON.parse(j.requiredCerts).length ? ` | Certs: ${JSON.parse(j.requiredCerts).join(', ')}` : ''}`).join('\n')}`);

    // Channel-specific instructions
    if (channel === 'customer') {
      sections.push(`# Channel: Customer-Facing
You are speaking directly to customers. Be warm, professional, and helpful — like a friendly neighbor who happens to run a Fortune 500.
- Use the customer's name when you know it
- Explain what you're doing and why
- Give clear time estimates
- Never expose internal scheduling details or tech performance metrics
- If you need to reschedule, be honest and offer something to make it right
- Confirm bookings with: tech name, arrival window, job type, estimated cost range`);
    } else {
      sections.push(`# Channel: Unified Dispatch Group
This is the main dispatch group chat. Messages come from both customers and the ops team.
- Each message is prefixed with the sender's name in brackets: [Name]: message
- Adapt your tone based on who you're talking to
- For customer inquiries: be warm, professional, helpful. Don't expose internal metrics.
- For ops/dispatch questions: be direct, data-driven, show your reasoning
- Show your reasoning for dispatch decisions
- Flag risks and tradeoffs
- Report schedule changes with before/after
- Use tech IDs and job IDs for precision when discussing ops topics
- Proactively suggest optimizations
- Alert on: idle techs, skill mismatches, customer tier conflicts, overdue payments`);
    }

    return sections.join('\n\n');
  }
}
