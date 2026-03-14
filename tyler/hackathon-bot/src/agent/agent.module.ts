import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { SystemPromptBuilder } from './system-prompt.builder';

@Module({
  providers: [AgentService, SystemPromptBuilder],
  exports: [AgentService],
})
export class AgentModule {}
