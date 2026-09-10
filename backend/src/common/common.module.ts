import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessPolicyService } from './services/access-policy.service';
import { RolesGuard } from './guards/roles.guard';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [AccessPolicyService, RolesGuard],
  exports: [AccessPolicyService, RolesGuard],
})
export class CommonModule {}
