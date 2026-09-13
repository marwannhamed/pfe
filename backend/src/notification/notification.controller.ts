import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Put,
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
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user';
import { USER_ROLE } from '../constants/enums';
import { ForbiddenException } from '@nestjs/common';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @Roles(USER_ROLE.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Créer une notification',
    description:
      'Platform owner only. Application notifications are raised by the services that own the event, not over HTTP.',
  })
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister ses notifications' })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Platform owner only; other roles always see their own.',
  })
  @ApiQuery({ name: 'isRead', required: false })
  @ApiQuery({ name: 'type', required: false })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('userId') userId?: string,
    @Query('isRead') isRead?: string,
    @Query('type') type?: string,
  ) {
    return this.notificationService.findAll(user, userId, isRead, type);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Nombre de notifications non lues' })
  @ApiQuery({ name: 'userId', required: false })
  getUnreadCount(
    @CurrentUser() user: AuthUser,
    @Query('userId') userId?: string,
  ) {
    return this.notificationService.getUnreadCount(user, userId);
  }

  // Must stay above @Get(':id'), or "stats" is read as a notification id.
  @Get('stats')
  @ApiOperation({ summary: 'Totaux de notifications (total / non lues / par type)' })
  @ApiQuery({ name: 'userId', required: false })
  getStats(
    @CurrentUser() user: AuthUser,
    @Query('userId') userId?: string,
  ) {
    return this.notificationService.getStats(user, userId);
  }

  @Get('preferences/me')
  @ApiOperation({
    summary: 'Get notification preferences for the current user',
  })
  getMyPreferences(@CurrentUser() user: AuthUser) {
    return this.notificationService.getPreferences(user.id);
  }

  @Put('preferences/me')
  @ApiOperation({
    summary: 'Update notification preferences for the current user',
  })
  updateMyPreferences(
    @CurrentUser() user: AuthUser,
    @Body() preferences: Record<string, unknown>,
  ) {
    return this.notificationService.updatePreferences(user.id, preferences);
  }

  @Get('preferences/:userId')
  @ApiOperation({ summary: 'Get notification preferences for a user' })
  @ApiParam({ name: 'userId' })
  getPreferences(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (userId !== user.id && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException();
    }
    return this.notificationService.getPreferences(userId);
  }

  @Put('preferences/:userId')
  @ApiOperation({ summary: 'Update notification preferences for a user' })
  @ApiParam({ name: 'userId' })
  updatePreferences(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
    @Body() preferences: Record<string, unknown>,
  ) {
    if (userId !== user.id && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException();
    }
    return this.notificationService.updatePreferences(userId, preferences);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer une notification' })
  @ApiParam({ name: 'id' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notificationService.findOne(user, id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marquer une notification comme lue' })
  @ApiParam({ name: 'id' })
  markAsRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notificationService.markAsRead(user, id);
  }

  @Patch('read-all/:userId')
  @ApiOperation({ summary: 'Marquer toutes ses notifications comme lues' })
  @ApiParam({
    name: 'userId',
    description: 'Honoured for the platform owner only; ignored otherwise.',
  })
  markAllAsRead(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
  ) {
    return this.notificationService.markAllAsRead(user, userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marquer toutes ses notifications comme lues' })
  markAllMineAsRead(@CurrentUser() user: AuthUser) {
    return this.notificationService.markAllAsRead(user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une notification' })
  @ApiParam({ name: 'id' })
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.notificationService.remove(user, id);
  }
}
