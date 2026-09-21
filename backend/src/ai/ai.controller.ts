import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';
import { OpenAiService } from './openai.service';
import { MaintenanceTriageService } from './maintenance-triage.service';
import {
  LeaseAssistantDto,
  TenantAssistantDto,
  MaintenanceSuggestDto,
} from './dto/ai-chat.dto';

const AI_ROLES = [
  USER_ROLE.SUPER_ADMIN,
  USER_ROLE.MANAGER,
  USER_ROLE.TENANT_ADMIN,
  USER_ROLE.TENANT_EMPLOYEE,
  USER_ROLE.FINANCE,
  USER_ROLE.MAINTENANCE,
] as const;

@ApiTags('AI (OpenAI)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly openAi: OpenAiService,
    private readonly triage: MaintenanceTriageService,
  ) {}

  @Post('lease-assistant')
  @Roles(...AI_ROLES)
  @ApiOperation({ summary: 'Lease / contract Q&A (OpenAI)' })
  async leaseAssistant(
    @CurrentUser() user: AuthUser,
    @Body() dto: LeaseAssistantDto,
  ) {
    const system = `You are a concise commercial lease assistant for office properties.
Tenant context: user role ${user.role}. Answer in plain language. If unsure, say what information is missing. Do not invent legal facts; remind users to verify with counsel.`;
    const reply = await this.openAi.chat(
      dto.messages.map((m) => ({ role: m.role, content: m.content })),
      system,
    );
    return { reply };
  }

  @Post('tenant-assistant')
  @Roles(...AI_ROLES)
  @ApiOperation({
    summary: 'Tenant-facing help: bookings, spaces, billing basics (OpenAI)',
  })
  async tenantAssistant(
    @CurrentUser() user: AuthUser,
    @Body() dto: TenantAssistantDto,
  ) {
    const system = `You help tenants use a coworking / office lease platform: bookings, spaces, invoices, maintenance requests.
User role: ${user.role}. Be short, friendly, and actionable. Never promise refunds or legal outcomes. If policy-specific, suggest they contact their site manager.`;
    const reply = await this.openAi.chat(
      dto.messages.map((m) => ({ role: m.role, content: m.content })),
      system,
    );
    return { reply };
  }

  @Post('maintenance/triage')
  @Roles(...AI_ROLES)
  @ApiOperation({
    summary:
      'Triage a maintenance request: category, priority, and — for staff who can assign — a suggested technician and past fixes',
  })
  async triageMaintenance(
    @CurrentUser() user: AuthUser,
    @Body() dto: MaintenanceSuggestDto,
  ) {
    return this.triage.triage(user, {
      title: dto.title,
      description: dto.description,
    });
  }
}
