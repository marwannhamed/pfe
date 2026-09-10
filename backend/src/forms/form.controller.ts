import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';
import { FormService } from './form.service';
import { TypeformWebhookService } from './typeform-webhook.service';
import { CreateTypeformInquiryDto } from './dto/create-typeform-inquiry.dto';

@ApiTags('Forms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('forms')
export class FormController {
  constructor(
    private readonly forms: FormService,
    private readonly typeformWebhooks: TypeformWebhookService,
  ) {}

  @Post('typeform/inquiry')
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Create inquiry + pre-filled Typeform URL (hidden inquiry_id, site_id, space_id)' })
  createTypeformInquiry(@CurrentUser() user: AuthUser, @Body() dto: CreateTypeformInquiryDto) {
    return this.forms.createTypeformInquiry(user, dto);
  }

  @Post('typeform/simulate/:inquiryId')
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({
    summary: 'DEV ONLY — simulate Typeform submission locally (no ngrok)',
  })
  simulateTypeformLocal(
    @Param('inquiryId') inquiryId: string,
    @Body() body: { email?: string; companyName?: string },
  ) {
    return this.typeformWebhooks.simulateLocalSubmission(inquiryId, body);
  }
}
