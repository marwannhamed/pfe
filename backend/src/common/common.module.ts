import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessPolicyService } from './services/access-policy.service';
import { RolesGuard } from './guards/roles.guard';

/**
 * PassportModule is re-exported globally because JwtAuthGuard extends
 * AuthGuard('jwt'), and from @nestjs/passport v12 that base class injects
 * AuthModuleOptions. Twenty-six controllers apply the guard; without this each
 * of their modules would have to import PassportModule itself.
 */
const GlobalPassport = PassportModule.register({ defaultStrategy: 'jwt' });

@Global()
@Module({
  imports: [PrismaModule, GlobalPassport],
  providers: [AccessPolicyService, RolesGuard],
  exports: [AccessPolicyService, RolesGuard, GlobalPassport],
})
export class CommonModule {}
