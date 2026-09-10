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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user';
import { ForbiddenException } from '@nestjs/common';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @ApiOperation({ summary: 'Créer une notification' })
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les notifications' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'isRead', required: false })
  @ApiQuery({ name: 'type', required: false })
  findAll(
    @Query('userId') userId?: string,
    @Query('isRead') isRead?: string,
    @Query('type') type?: string,
  ) {
    return this.notificationService.findAll(userId, isRead, type);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Nombre de notifications non lues' })
  @ApiQuery({ name: 'userId', required: true })
  getUnreadCount(@Query('userId') userId: string) {
    return this.notificationService.getUnreadCount(userId);
  }

  @Get('preferences/me')
  @ApiOperation({ summary: 'Get notification preferences for the current user' })
  getMyPreferences(@CurrentUser() user: AuthUser) {
    return this.notificationService.getPreferences(user.id);
  }

  @Put('preferences/me')
  @ApiOperation({ summary: 'Update notification preferences for the current user' })
  updateMyPreferences(
    @CurrentUser() user: AuthUser,
    @Body() preferences: Record<string, unknown>,
  ) {
    return this.notificationService.updatePreferences(user.id, preferences);
  }

  @Get('preferences/:userId')
  @ApiOperation({ summary: 'Get notification preferences for a user' })
  @ApiParam({ name: 'userId' })
  getPreferences(@Param('userId') userId: string, @CurrentUser() user: AuthUser) {
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
  findOne(@Param('id') id: string) {
    return this.notificationService.findOne(id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marquer une notification comme lue' })
  @ApiParam({ name: 'id' })
  markAsRead(@Param('id') id: string) {
    return this.notificationService.markAsRead(id);
  }

  @Patch('read-all/:userId')
  @ApiOperation({ summary: 'Marquer toutes les notifications comme lues' })
  @ApiParam({ name: 'userId' })
  markAllAsRead(@Param('userId') userId: string) {
    return this.notificationService.markAllAsRead(userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une notification' })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.notificationService.remove(id);
  }
}
