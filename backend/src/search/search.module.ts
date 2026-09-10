import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ApiVersionGuard } from '../common/guards/api-version.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { CacheInterceptor } from '../common/interceptors/cache.interceptor';

@Module({
  imports: [PrismaModule],
  controllers: [SearchController],
  providers: [SearchService, ApiVersionGuard, RateLimitGuard, CacheInterceptor],
})
export class SearchModule {}
