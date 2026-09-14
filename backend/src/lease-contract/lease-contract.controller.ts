import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LeaseContractService } from './lease-contract.service';
import { CreateLeaseContractDto } from './dto/create-lease-contract.dto';
import { UpdateLeaseContractDto } from './dto/update-lease-contract.dto';
import { CreateContractItemDto } from './dto/create-contract-item.dto';
import { CreateDepositDto, RefundDepositDto } from './dto/create-deposit.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { USER_ROLE } from '../constants/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user';

@ApiTags('Lease Contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('lease-contracts')
export class LeaseContractController {
  constructor(private readonly leaseContractService: LeaseContractService) {}

  // ─── CRUD ─────────────────────────────────────────────────────

  @Post()
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Créer un contrat de bail' })
  create(@Body() dto: CreateLeaseContractDto) {
    return this.leaseContractService.create(dto);
  }

  @Get()
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.CLIENT_ADMIN,
    USER_ROLE.MANAGER,
    USER_ROLE.FINANCE,
    USER_ROLE.TENANT_ADMIN,
    USER_ROLE.TENANT_EMPLOYEE,
  )
  @ApiOperation({ summary: 'Lister tous les contrats' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: string,
  ) {
    return this.leaseContractService.findAllForUser(user, tenantId, status);
  }

  @Get('expiring')
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.CLIENT_ADMIN,
    USER_ROLE.MANAGER,
    USER_ROLE.FINANCE,
    USER_ROLE.TENANT_ADMIN,
    USER_ROLE.TENANT_EMPLOYEE,
  )
  @ApiOperation({ summary: 'Contrats expirant bientôt' })
  @ApiQuery({ name: 'daysAhead', required: false, example: 30 })
  getExpiringContracts(
    @CurrentUser() user: AuthUser,
    @Query('daysAhead') daysAhead?: string,
  ) {
    return this.leaseContractService.getExpiringContractsForUser(
      user,
      daysAhead ? Number(daysAhead) : 30,
    );
  }

  @Get(':id')
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.CLIENT_ADMIN,
    USER_ROLE.MANAGER,
    USER_ROLE.FINANCE,
    USER_ROLE.TENANT_ADMIN,
    USER_ROLE.TENANT_EMPLOYEE,
  )
  @ApiOperation({ summary: 'Récupérer un contrat' })
  @ApiParam({ name: 'id' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.leaseContractService.findOneForUser(user, id);
  }

  @Patch(':id')
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Mettre à jour un contrat' })
  @ApiParam({ name: 'id' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeaseContractDto,
  ) {
    return this.leaseContractService.updateForUser(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Supprimer un contrat' })
  @ApiParam({ name: 'id' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.leaseContractService.removeForUser(user, id);
  }

  // ─── ACTIONS ──────────────────────────────────────────────────

  @Patch(':id/sign')
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.CLIENT_ADMIN,
    USER_ROLE.MANAGER,
    USER_ROLE.TENANT_ADMIN,
  )
  @ApiOperation({ summary: 'Signer un contrat (DRAFT → ACTIVE)' })
  @ApiParam({ name: 'id' })
  sign(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.leaseContractService.signForUser(user, id);
  }

  @Patch(':id/terminate')
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Résilier un contrat (ACTIVE → TERMINATED)' })
  @ApiParam({ name: 'id' })
  terminate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.leaseContractService.terminateForUser(user, id);
  }

  @Patch(':id/renew')
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Renouveler un contrat' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'newEndDate', required: true, example: '2027-12-31' })
  renew(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('newEndDate') newEndDate: string,
  ) {
    return this.leaseContractService.renewForUser(user, id, newEndDate);
  }

  // ─── CONTRACT ITEMS ───────────────────────────────────────────

  @Post(':id/items')
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Ajouter un élément au contrat' })
  @ApiParam({ name: 'id' })
  addItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateContractItemDto,
  ) {
    return this.leaseContractService.addItemForUser(user, id, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Supprimer un élément du contrat' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'itemId' })
  removeItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.leaseContractService.removeItemForUser(user, id, itemId);
  }

  // ─── DEPOSIT ──────────────────────────────────────────────────

  @Post(':id/deposit')
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.CLIENT_ADMIN,
    USER_ROLE.MANAGER,
    USER_ROLE.FINANCE,
  )
  @ApiOperation({ summary: 'Enregistrer le dépôt de garantie' })
  @ApiParam({ name: 'id' })
  createDeposit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateDepositDto,
  ) {
    return this.leaseContractService.createDepositForUser(user, id, dto);
  }

  @Patch(':id/deposit/refund')
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.CLIENT_ADMIN,
    USER_ROLE.MANAGER,
    USER_ROLE.FINANCE,
  )
  @ApiOperation({ summary: 'Rembourser le dépôt de garantie' })
  @ApiParam({ name: 'id' })
  refundDeposit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RefundDepositDto,
  ) {
    return this.leaseContractService.refundDepositForUser(user, id, dto);
  }
}
