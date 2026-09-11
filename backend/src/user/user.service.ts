import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { MailService } from '../mail/mail.service';
import { USER_ROLE, normalizeUserRole } from '../constants/enums';
import { assertPhoneE164 } from '../common/validators/phone.validator';
import type { AuthUser } from '../auth/types/auth-user';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  private exclude(user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest } = user;
    return rest;
  }

  async create(dto: CreateUserDto, options?: { skipWelcomeEmail?: boolean }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing)
      throw new ConflictException(`Email "${dto.email}" déjà utilisé`);

    if (dto.role === USER_ROLE.RECEPTIONIST && !dto.managed_by_id) {
      throw new BadRequestException(
        'managed_by_id is required for receptionist accounts',
      );
    }
    if (dto.role === USER_ROLE.RECEPTIONIST && dto.managed_by_id) {
      const manager = await this.prisma.user.findUnique({
        where: { id: dto.managed_by_id },
      });
      if (
        !manager ||
        ![
          USER_ROLE.MANAGER,
          USER_ROLE.CLIENT_ADMIN,
          USER_ROLE.SUPER_ADMIN,
        ].includes(manager.role as any)
      ) {
        throw new BadRequestException(
          'managed_by_id must reference a site manager or super admin',
        );
      }
      if (manager.tenant_id !== dto.tenant_id) {
        throw new BadRequestException(
          'Receptionist must belong to the same organization as their manager',
        );
      }
    }

    const { password, ...profile } = dto;
    const hashed = await bcrypt.hash(password, 10);
    const phone = assertPhoneE164(profile.phone_number!);
    const user = await this.prisma.user.create({
      data: { ...profile, phone_number: phone, password: hashed },
    });

    if (!options?.skipWelcomeEmail) {
      this.mailService.sendWelcome({
        to: user.email,
        firstName: user.first_name ?? user.email.split('@')[0],
        lastName: user.last_name ?? '',
        role: user.role,
        loginUrl: `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/login`,
      });
    }

    return this.exclude(user);
  }

  async createForUser(
    actor: AuthUser,
    dto: CreateUserDto,
    options?: { skipWelcomeEmail?: boolean },
  ) {
    const actorRole = normalizeUserRole(actor.role);
    if (actorRole === USER_ROLE.SUPER_ADMIN) {
      return this.create(dto, options);
    }
    if (actorRole === USER_ROLE.CLIENT_ADMIN) {
      const allowed: string[] = [
        USER_ROLE.MANAGER,
        USER_ROLE.FINANCE,
        USER_ROLE.MAINTENANCE,
        USER_ROLE.RECEPTIONIST,
      ];
      if (!allowed.includes(dto.role ?? '')) {
        throw new ForbiddenException(
          'Client admins can only invite manager, finance, maintenance, or reception roles',
        );
      }
      if (dto.tenant_id && dto.tenant_id !== actor.tenant_id) {
        throw new ForbiddenException(
          'Cannot create users outside your organization',
        );
      }
      const payload: CreateUserDto = { ...dto, tenant_id: actor.tenant_id };
      if (dto.role === USER_ROLE.RECEPTIONIST) {
        payload.managed_by_id = dto.managed_by_id ?? actor.id;
      }
      return this.create(payload, options);
    }
    if (actorRole === USER_ROLE.MANAGER) {
      const allowed: string[] = [
        USER_ROLE.FINANCE,
        USER_ROLE.MAINTENANCE,
        USER_ROLE.RECEPTIONIST,
      ];
      if (!allowed.includes(dto.role ?? '')) {
        throw new ForbiddenException(
          'Managers can only invite finance, maintenance, or reception staff',
        );
      }
      const payload: CreateUserDto = {
        ...dto,
        tenant_id: actor.tenant_id,
        managed_by_id:
          dto.role === USER_ROLE.RECEPTIONIST ? actor.id : dto.managed_by_id,
      };
      return this.create(payload, options);
    }
    if (actorRole === USER_ROLE.TENANT_ADMIN) {
      if (dto.role !== USER_ROLE.TENANT_EMPLOYEE) {
        throw new ForbiddenException('Tenant admins can only invite employees');
      }
      return this.create(
        {
          ...dto,
          tenant_id: actor.tenant_id,
          tenant_company_id: actor.tenant_company_id ?? actor.tenant_id,
        },
        options,
      );
    }
    throw new ForbiddenException('You cannot create users');
  }

  async inviteForUser(actor: AuthUser, dto: InviteUserDto) {
    const { send_email, ...userFields } = dto;
    const tempPassword = `${randomBytes(18).toString('base64url')}Aa1!`;
    const payload: CreateUserDto = {
      ...userFields,
      password: tempPassword,
    };
    const created = await this.createForUser(actor, payload, {
      skipWelcomeEmail: true,
    });
    await this.prisma.user.update({
      where: { id: created.id },
      data: { must_change_password: true },
    });

    let invite_email_sent = false;
    if (send_email !== false) {
      invite_email_sent = await this.authService.sendTeamInviteEmail(
        created.id,
        actor,
      );
    }

    return { ...created, must_change_password: true, invite_email_sent };
  }

  async findAllForUser(actor: AuthUser, tenantId?: string, role?: string) {
    const actorRole = normalizeUserRole(actor.role);
    if (actorRole === USER_ROLE.SUPER_ADMIN) {
      return this.findAll(tenantId, role);
    }
    if (actorRole === USER_ROLE.CLIENT_ADMIN) {
      return this.findAll(actor.tenant_id, role);
    }
    if (actorRole === USER_ROLE.MANAGER) {
      return this.findAll(actor.tenant_id, role);
    }
    if (actorRole === USER_ROLE.TENANT_ADMIN) {
      return this.findAll(actor.tenant_id, role ?? USER_ROLE.TENANT_EMPLOYEE);
    }
    throw new ForbiddenException('You cannot list users');
  }

  async findAll(tenantId?: string, role?: string, managedById?: string) {
    const users = await this.prisma.user.findMany({
      where: {
        ...(tenantId ? { tenant_id: tenantId } : {}),
        ...(role ? { role } : {}),
        ...(managedById ? { managed_by_id: managedById } : {}),
      },
      include: {
        managedBy: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
    return users.map(this.exclude);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User #${id} introuvable`);
    return user;
  }

  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException(`Email introuvable`);
    return user;
  }

  async updateForUser(actor: AuthUser, id: string, dto: UpdateUserDto) {
    const target = await this.findOne(id);
    const actorRole = normalizeUserRole(actor.role);

    if (actor.id === id) {
      const { first_name, last_name, email, phone_number, crisp_session_id } =
        dto;
      const selfUpdate: UpdateUserDto = {
        ...(first_name !== undefined ? { first_name } : {}),
        ...(last_name !== undefined ? { last_name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phone_number !== undefined ? { phone_number } : {}),
        ...(crisp_session_id !== undefined ? { crisp_session_id } : {}),
      };
      return this.update(id, selfUpdate);
    }

    if (actorRole === USER_ROLE.SUPER_ADMIN) {
      return this.update(id, dto);
    }

    if (actorRole === USER_ROLE.CLIENT_ADMIN) {
      if (target.tenant_id !== actor.tenant_id) {
        throw new ForbiddenException(
          'Cannot update users outside your organization',
        );
      }
      return this.update(id, dto);
    }

    if (actorRole === USER_ROLE.MANAGER) {
      if (target.tenant_id !== actor.tenant_id) {
        throw new ForbiddenException(
          'Cannot update users outside your organization',
        );
      }
      const manageable: string[] = [
        USER_ROLE.FINANCE,
        USER_ROLE.MAINTENANCE,
        USER_ROLE.RECEPTIONIST,
      ];
      if (!manageable.includes(target.role)) {
        throw new ForbiddenException(
          'Managers can only update finance, maintenance, or reception staff',
        );
      }
      const { first_name, last_name, email, phone_number, status } = dto;
      return this.update(id, {
        first_name,
        last_name,
        email,
        phone_number,
        status,
      });
    }

    if (actorRole === USER_ROLE.TENANT_ADMIN) {
      if (target.tenant_id !== actor.tenant_id) {
        throw new ForbiddenException(
          'Cannot update users outside your organization',
        );
      }
      if (target.role !== USER_ROLE.TENANT_EMPLOYEE) {
        throw new ForbiddenException('Tenant admins can only update employees');
      }
      return this.update(id, dto);
    }

    throw new ForbiddenException('You cannot update this user');
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    const data = { ...dto } as UpdateUserDto;
    if (data.phone_number) {
      data.phone_number = assertPhoneE164(data.phone_number);
    }
    const user = await this.prisma.user.update({ where: { id }, data });
    return this.exclude(user);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { message: 'Utilisateur supprimé' };
  }

  async updateLastLogin(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { last_login_at: new Date() },
    });
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User #${id} introuvable`);

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const hashed = await bcrypt.hash(newPassword, 10);
    return this.exclude(
      await this.prisma.user.update({
        where: { id },
        data: { password: hashed, must_change_password: false },
      }),
    );
  }
}
