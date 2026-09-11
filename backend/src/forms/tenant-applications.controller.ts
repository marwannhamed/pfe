import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';
import { TenantApplicationService } from './tenant-application.service';
import { RejectApplicationDto } from './dto/reject-application.dto';

@ApiTags('Tenant applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tenant-applications')
export class TenantApplicationsController {
  constructor(private readonly applications: TenantApplicationService) {}

  @Get('pending')
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'List submitted applications awaiting approval' })
  listPending(@CurrentUser() user: AuthUser) {
    return this.applications.listPending(user);
  }

  @Post(':id/approve')
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({
    summary:
      'Approve application — activate tenant (TRIAL), create TENANT_ADMIN if needed, send password setup email',
  })
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.applications.approve(user, id);
  }

  @Post(':id/reject')
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({
    summary: 'Reject application — mark rejected, suspend pending tenant',
  })
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: RejectApplicationDto,
  ) {
    return this.applications.reject(user, id, body?.reason);
  }
}
