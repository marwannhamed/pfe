import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { AUDIT_ACTION, AUDIT_SEVERITY } from '../constants/enums';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAuditLogDto) {
    return this.prisma.auditLog.create({
      data: {
        tenant_id: dto.tenant_id,
        user_id: dto.user_id,
        action: dto.action,
        resource_type: dto.resource_type,
        resource_id: dto.resource_id,
        entity_type: dto.entity_type,
        entity_id: dto.entity_id,
        ip_address: dto.ip_address,
        user_agent: dto.user_agent,
        severity: dto.severity ?? AUDIT_SEVERITY.INFO,
        old_values: dto.old_values ? JSON.stringify(dto.old_values) : null,
        new_values: dto.new_values ? JSON.stringify(dto.new_values) : null,
      },
      include: { user: true, tenant: true },
    });
  }

  async log(
    tenantId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    options?: {
      userId?: string;
      oldValues?: Record<string, any>;
      newValues?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
      severity?: string;
    },
  ) {
    return this.prisma.auditLog.create({
      data: {
        tenant_id: tenantId,
        user_id: options?.userId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        old_values: options?.oldValues ? JSON.stringify(options.oldValues) : null,
        new_values: options?.newValues ? JSON.stringify(options.newValues) : null,
        ip_address: options?.ipAddress,
        user_agent: options?.userAgent,
        severity: options?.severity ?? AUDIT_SEVERITY.INFO,
      },
    });
  }

  async getLoginActivityForUser(userId: string, limit = 50) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        user_id: userId,
        action: {
          in: [
            AUDIT_ACTION.LOGIN,
            AUDIT_ACTION.LOGOUT,
            AUDIT_ACTION.LOGIN_FAILED,
          ],
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      select: {
        id: true,
        action: true,
        ip_address: true,
        user_agent: true,
        created_at: true,
        new_values: true,
        severity: true,
      },
    });

    return logs.map((log) => {
      let meta: Record<string, unknown> = {};
      if (log.new_values) {
        try {
          meta = JSON.parse(log.new_values) as Record<string, unknown>;
        } catch {
          meta = {};
        }
      }
      return {
        id: log.id,
        action: log.action,
        ip_address: log.ip_address,
        user_agent: log.user_agent,
        created_at: log.created_at,
        session_id: meta.session_id ?? null,
        email: meta.email ?? null,
      };
    });
  }

  async findAll(
    tenantId?: string,
    userId?: string,
    action?: string,
    resourceType?: string,
    severity?: string,
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        ...(tenantId && { tenant_id: tenantId }),
        ...(userId && { user_id: userId }),
        ...(action && { action }),
        ...(resourceType && { resource_type: resourceType }),
        ...(severity && { severity }),
      },
      include: { user: true, tenant: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: { user: true, tenant: true },
    });
    if (!log) throw new NotFoundException(`AuditLog #${id} introuvable`);
    return log;
  }

  async getChangesSummary(id: string) {
    const log = await this.findOne(id);
    const changes: string[] = [];

    if (log.old_values && log.new_values) {
      // Deserialize from string (SQLite stores JSON as text)
      const oldVals = JSON.parse(log.old_values as string) as Record<string, any>;
      const newVals = JSON.parse(log.new_values as string) as Record<string, any>;

      for (const key of Object.keys(newVals)) {
        if (oldVals[key] !== newVals[key]) {
          changes.push(`${key}: "${oldVals[key]}" → "${newVals[key]}"`);
        }
      }
    }

    return {
      id: log.id,
      action: log.action,
      resource_type: log.resource_type,
      resource_id: log.resource_id,
      changes: changes.length > 0 ? changes : ['Aucun changement détecté'],
      performed_by: log.user,
      created_at: log.created_at,
    };
  }

  async getStats(tenantId?: string) {
    const where = tenantId ? { tenant_id: tenantId } : {};

    const [total, creates, updates, deletes, logins] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.count({ where: { ...where, action: AUDIT_ACTION.CREATE } }),
      this.prisma.auditLog.count({ where: { ...where, action: AUDIT_ACTION.UPDATE } }),
      this.prisma.auditLog.count({ where: { ...where, action: AUDIT_ACTION.DELETE } }),
      this.prisma.auditLog.count({ where: { ...where, action: AUDIT_ACTION.LOGIN } }),
    ]);

    return { total, creates, updates, deletes, logins };
  }
}