import { Module, Global } from '@nestjs/common';
import { BusinessConfigService } from './config.service';

@Global()
@Module({
  providers: [BusinessConfigService],
  exports: [BusinessConfigService],
})
export class BusinessConfigModule {}
