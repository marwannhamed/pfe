import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaintenanceTicketDto } from './dto/create-maintenance-ticket.dto';
import { UpdateMaintenanceTicketDto } from './dto/update-maintenance-ticket.dto';
import { TicketStatus, TicketPriority, SpaceStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Générer un numéro de ticket unique ───────────────────────
  private generateTicketNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = uuidv4().split('-')[0].toUpperCase();
    return `TK-${year}${month}${day}-${random}`;
  }

  // ─── CREATE ──────────────────────────────────────────────────
  async create(dto: CreateMaintenanceTicketDto) {
    // Vérifier que l'espace existe
    const space = await this.prisma.space.findUnique({
      where: { id: dto.space_id },
    });
    if (!space) throw new NotFoundException(`Space #${dto.space_id} introuvable`);

    const ticket = await this.prisma.maintenanceTicket.create({
      data: {
        ...dto,
        ticket_number: this.generateTicketNumber(),
        reported_at:   new Date(),
        status:        dto.status   ?? TicketStatus.OPEN,
        priority:      dto.priority ?? TicketPriority.NORMAL,
      },
      include: {
        space:      true,
        createdBy:  true,
        assignedTo: true,
      },
    });

    // Si le ticket est URGENT ou EMERGENCY → mettre l'espace en MAINTENANCE
    if (
      ticket.priority === TicketPriority.URGENT ||
      ticket.priority === TicketPriority.EMERGENCY
    ) {
      await this.prisma.space.update({
        where: { id: dto.space_id },
        data:  { status: SpaceStatus.MAINTENANCE },
      });
    }

    return ticket;
  }

  // ─── FIND ALL ─────────────────────────────────────────────────
  async findAll(
    spaceId?:   string,
    status?:    string,
    priority?:  string,
    category?:  string,
    assignedTo?: string,
  ) {
    return this.prisma.maintenanceTicket.findMany({
      where: {
        ...(spaceId    && { space_id: spaceId }),
        ...(status     && { status:   status   as TicketStatus }),
        ...(priority   && { priority: priority as TicketPriority }),
        ...(category   && { category: category as any }),
        ...(assignedTo && { assigned_to_user_id: assignedTo }),
      },
      include: {
        space:      true,
        createdBy:  true,
        assignedTo: true,
      },
      orderBy: [
        { priority:    'desc' },
        { reported_at: 'desc' },
      ],
    });
  }

  // ─── FIND ONE ─────────────────────────────────────────────────
  async findOne(id: string) {
    const ticket = await this.prisma.maintenanceTicket.findUnique({
      where: { id },
      include: {
        space:      { include: { floor: { include: { building: true } } } },
        createdBy:  true,
        assignedTo: true,
      },
    });
    if (!ticket) throw new NotFoundException(`Ticket #${id} introuvable`);
    return ticket;
  }

  // ─── UPDATE ──────────────────────────────────────────────────
  async update(id: string, dto: UpdateMaintenanceTicketDto) {
    await this.findOne(id);
    return this.prisma.maintenanceTicket.update({
      where: { id },
      data:  dto,
      include: {
        space:      true,
        createdBy:  true,
        assignedTo: true,
      },
    });
  }

  // ─── DELETE ──────────────────────────────────────────────────
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.maintenanceTicket.delete({ where: { id } });
  }

  // ─── ASSIGN ──────────────────────────────────────────────────
  async assign(id: string, assignedToUserId: string) {
    const ticket = await this.findOne(id);

    const status = ticket.status as TicketStatus;
    if (status === TicketStatus.CLOSED || status === TicketStatus.CANCELLED) {
      throw new BadRequestException(
        `Impossible d'assigner un ticket ${ticket.status}`,
      );
    }

    // Vérifier que l'utilisateur existe
    const user = await this.prisma.user.findUnique({
      where: { id: assignedToUserId },
    });
    if (!user) throw new NotFoundException(`User #${assignedToUserId} introuvable`);

    return this.prisma.maintenanceTicket.update({
      where: { id },
      data: {
        assigned_to_user_id: assignedToUserId,
        status:              TicketStatus.ASSIGNED,
      },
      include: { assignedTo: true },
    });
  }

  // ─── START PROGRESS ───────────────────────────────────────────
  async startProgress(id: string) {
    const ticket = await this.findOne(id);
    const status = ticket.status as TicketStatus;

    if (status !== TicketStatus.ASSIGNED) {
      throw new BadRequestException(
        `Le ticket doit être ASSIGNED pour démarrer (statut: ${ticket.status})`,
      );
    }

    return this.prisma.maintenanceTicket.update({
      where: { id },
      data:  { status: TicketStatus.IN_PROGRESS },
    });
  }

  // ─── RESOLVE ─────────────────────────────────────────────────
  async resolve(id: string, cost?: number) {
    const ticket = await this.findOne(id);
    const status = ticket.status as TicketStatus;

    if (status !== TicketStatus.IN_PROGRESS && status !== TicketStatus.ASSIGNED) {
      throw new BadRequestException(
        `Le ticket doit être IN_PROGRESS ou ASSIGNED pour être résolu`,
      );
    }

    const updatedTicket = await this.prisma.maintenanceTicket.update({
      where: { id },
      data: {
        status:      TicketStatus.RESOLVED,
        resolved_at: new Date(),
        ...(cost !== undefined && { cost }),
      },
      include: { space: true },
    });

    // Remettre l'espace en AVAILABLE si plus aucun ticket actif
    const activeTickets = await this.prisma.maintenanceTicket.count({
      where: {
        space_id: ticket.space_id,
        status: {
          notIn: [
            TicketStatus.RESOLVED,
            TicketStatus.CLOSED,
            TicketStatus.CANCELLED,
          ],
        },
      },
    });

    if (activeTickets === 0) {
      await this.prisma.space.update({
        where: { id: ticket.space_id },
        data:  { status: SpaceStatus.AVAILABLE },
      });
    }

    return updatedTicket;
  }

  // ─── CLOSE ───────────────────────────────────────────────────
  async close(id: string) {
    const ticket = await this.findOne(id);
    const status = ticket.status as TicketStatus;

    if (status !== TicketStatus.RESOLVED) {
      throw new BadRequestException(
        `Le ticket doit être RESOLVED pour être clôturé (statut: ${ticket.status})`,
      );
    }

    return this.prisma.maintenanceTicket.update({
      where: { id },
      data:  { status: TicketStatus.CLOSED },
    });
  }

  // ─── CANCEL ──────────────────────────────────────────────────
  async cancel(id: string) {
    const ticket = await this.findOne(id);
    const status = ticket.status as TicketStatus;

    if (status === TicketStatus.CLOSED || status === TicketStatus.CANCELLED) {
      throw new BadRequestException(
        `Impossible d'annuler un ticket ${ticket.status}`,
      );
    }

    return this.prisma.maintenanceTicket.update({
      where: { id },
      data:  { status: TicketStatus.CANCELLED },
    });
  }

  // ─── STATS ───────────────────────────────────────────────────
  async getStats(spaceId?: string) {
    const where = spaceId ? { space_id: spaceId } : {};

    const [total, open, inProgress, resolved, closed] = await Promise.all([
      this.prisma.maintenanceTicket.count({ where }),
      this.prisma.maintenanceTicket.count({ where: { ...where, status: TicketStatus.OPEN } }),
      this.prisma.maintenanceTicket.count({ where: { ...where, status: TicketStatus.IN_PROGRESS } }),
      this.prisma.maintenanceTicket.count({ where: { ...where, status: TicketStatus.RESOLVED } }),
      this.prisma.maintenanceTicket.count({ where: { ...where, status: TicketStatus.CLOSED } }),
    ]);

    const totalCost = await this.prisma.maintenanceTicket.aggregate({
      where: { ...where, status: TicketStatus.CLOSED },
      _sum:  { cost: true },
    });

    return {
      total,
      open,
      in_progress: inProgress,
      resolved,
      closed,
      total_cost:  Number(totalCost._sum.cost ?? 0),
    };
  }
}