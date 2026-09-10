import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { USER_ROLE, TICKET_CATEGORY } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';
import { OpenAiService } from './openai.service';
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
  constructor(private readonly openAi: OpenAiService) {}

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
  @ApiOperation({ summary: 'Tenant-facing help: bookings, spaces, billing basics (OpenAI)' })
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

  @Post('maintenance/suggest-category')
  @Roles(...AI_ROLES)
  @ApiOperation({ summary: 'Suggest maintenance ticket category from title/description (OpenAI)' })
  async suggestMaintenanceCategory(@Body() dto: MaintenanceSuggestDto) {
    const allowed = Object.values(TICKET_CATEGORY).join(', ');
    const system = `Classify the maintenance request into exactly one category from: ${allowed}.
Reply with a single line: CATEGORY|one short reason (max 120 chars). Example: PLUMBING|mentions leak`;
    const userMsg = [dto.title, dto.description].filter(Boolean).join('\n');
    const raw = await this.openAi.chat([{ role: 'user', content: userMsg }], system);
    const [catPart] = raw.split('|');
    const category = (catPart ?? '').trim().toUpperCase();
    const valid = Object.values(TICKET_CATEGORY).includes(category as any)
      ? category
      : TICKET_CATEGORY.OTHER;
    return { category: valid, raw };
  }
}
