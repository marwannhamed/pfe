import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { AuditAction, AuditSeverity } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── CREATE ──────────────────────────────────────────────────
  async create(dto: CreateAuditLogDto) {
    return this.prisma.auditLog.create({
      data: {
        ...dto,
        severity: dto.severity ?? AuditSeverity.INFO,
      },
      include: { user: true, tenant: true },
    });
  }

  // ─── LOG Helper (usage interne dans les services) ─────────────
  async log(
    tenantId: string,
    action: AuditAction,
    resourceType: string,
    resourceId: string,
    options?: {
      userId?: string;
      oldValues?: Record<string, any>;
      newValues?: Record<string, any>;
      ipAddress?: string;
      severity?: AuditSeverity;
    },
  ) {
    return this.prisma.auditLog.create({
      data: {
        tenant_id: tenantId,
        user_id: options?.userId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        old_values: options?.oldValues,
        new_values: options?.newValues,
        ip_address: options?.ipAddress,
        severity: options?.severity ?? AuditSeverity.INFO,
      },
    });
  }

  // ─── FIND ALL ─────────────────────────────────────────────────
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
        ...(action && { action: action as AuditAction }),
        ...(resourceType && { resource_type: resourceType }),
        ...(severity && { severity: severity as AuditSeverity }),
      },
      include: { user: true, tenant: true },
      orderBy: { created_at: 'desc' },
    });
  }

  // ─── FIND ONE ─────────────────────────────────────────────────
  async findOne(id: string) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: { user: true, tenant: true },
    });
    if (!log) throw new NotFoundException(`AuditLog #${id} introuvable`);
    return log;
  }

  // ─── GET CHANGES SUMMARY ──────────────────────────────────────
  async getChangesSummary(id: string) {
    const log = await this.findOne(id);
    const changes: string[] = [];

    if (log.old_values && log.new_values) {
      const oldVals = log.old_values as Record<string, any>;
      const newVals = log.new_values as Record<string, any>;

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

  // ─── GET STATS ────────────────────────────────────────────────
  async getStats(tenantId?: string) {
    const where = tenantId ? { tenant_id: tenantId } : {};

    const [total, creates, updates, deletes, logins] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.count({
        where: { ...where, action: AuditAction.CREATE },
      }),
      this.prisma.auditLog.count({
        where: { ...where, action: AuditAction.UPDATE },
      }),
      this.prisma.auditLog.count({
        where: { ...where, action: AuditAction.DELETE },
      }),
      this.prisma.auditLog.count({
        where: { ...where, action: AuditAction.LOGIN },
      }),
    ]);

    return { total, creates, updates, deletes, logins };
  }
}
