import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

/**
 * Buzón de notificaciones del usuario autenticado. Solo requiere `JwtAuthGuard`
 * (no permisos): cada quien lee y administra SU propio buzón. El usuario sale de
 * `req.user.userId` (mismo patrón que messaging).
 */
@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  private me(req: any): string {
    return req.user.userId;
  }

  @Get()
  @ApiOperation({ summary: 'Mis notificaciones (más recientes primero).' })
  list(
    @Req() req: any,
    @Query('unread') unread?: string,
    @Query('kind') kind?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list(this.me(req), {
      unreadOnly: unread === 'true' || unread === '1',
      kind,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('counts')
  @ApiOperation({ summary: 'Conteo de mi buzón: total y no leídas.' })
  counts(@Req() req: any) {
    return this.service.counts(this.me(req));
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Marca todas mis notificaciones como leídas.' })
  readAll(@Req() req: any) {
    return this.service.markAllRead(this.me(req));
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Marca una notificación como leída.' })
  read(@Req() req: any, @Param('id') id: string) {
    return this.service.markRead(this.me(req), id);
  }

  @Post(':id/unread')
  @ApiOperation({ summary: 'Marca una notificación como no leída.' })
  unread(@Req() req: any, @Param('id') id: string) {
    return this.service.markUnread(this.me(req), id);
  }
}
