import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

const isDev = (process.env.NODE_ENV || 'development') === 'development';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: isDev ? 10_000 : 100,
      },
    ]),
  ],
  exports: [ThrottlerModule],
})
export class SecurityModule {}
