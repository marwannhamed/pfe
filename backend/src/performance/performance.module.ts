import { Module, Global } from '@nestjs/common';
import { PerformanceService } from './performance.service';

@Global()
@Module({
  providers: [PerformanceService],
  exports: [PerformanceService],
})
export class PerformanceModule {}
