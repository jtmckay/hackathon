import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigModule } from '@nestjs/config';
import { BusinessConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AgentModule } from './agent/agent.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TelegrafModule.forRoot({
      token: process.env.BOT_TOKEN,
    }),
    BusinessConfigModule,
    DatabaseModule,
    AgentModule,
    TelegramModule,
  ],
})
export class AppModule {}
