import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/types/auth-user';
import { USER_ROLE, TENANT_APPLICATION_STATUS } from '../constants/enums';
import { CreateTypeformInquiryDto } from './dto/create-typeform-inquiry.dto';

@Injectable()
export class FormService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async resolveLandlordTenantId(
    dto: CreateTypeformInquiryDto,
  ): Promise<{
    landlord_tenant_id: string;
    space_id: string | null;
  }> {
    if (!dto.space_id) {
      throw new BadRequestException(
        'Provide space_id to scope the application',
      );
    }
    const space = await this.prisma.space.findUnique({
      where: { id: dto.space_id },
      include: { floor: { include: { building: true } } },
    });
    if (!space) throw new BadRequestException('Space not found');
    return {
      landlord_tenant_id: space.floor.building.tenant_id,
      space_id: space.id,
    };
  }

  assertCanCreateInquiry(user: AuthUser, landlord_tenant_id: string) {
    if (user.role === USER_ROLE.SUPER_ADMIN) return;
    if (
      user.role === USER_ROLE.MANAGER &&
      user.tenant_id === landlord_tenant_id
    )
      return;
    throw new ForbiddenException(
      'Only super admins or site managers for this organization can create application links',
    );
  }

  async createTypeformInquiry(user: AuthUser, dto: CreateTypeformInquiryDto) {
    const { landlord_tenant_id, space_id } =
      await this.resolveLandlordTenantId(dto);
    this.assertCanCreateInquiry(user, landlord_tenant_id);

    const app = await this.prisma.tenantApplication.create({
      data: {
        landlord_tenant_id,
        space_id,
        status: TENANT_APPLICATION_STATUS.AWAITING_SUBMISSION,
      },
    });

    const formId = this.config.get<string>('TYPEFORM_FORM_ID')?.trim();
    if (!formId) {
      throw new BadRequestException('TYPEFORM_FORM_ID is not configured');
    }
    const base =
      this.config.get<string>('TYPEFORM_BASE_URL')?.trim() ||
      'https://form.typeform.com/to';
    const enc = (v: string) => encodeURIComponent(v);
    const url = `${base.replace(/\/$/, '')}/${formId}#inquiry_id=${enc(app.id)}&space_id=${enc(space_id ?? '')}`;

    return {
      inquiry_id: app.id,
      typeform_url: url,
      hidden_fields: {
        inquiry_id: app.id,
        space_id: space_id ?? '',
      },
    };
  }
}
