import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { PushService, type BrowserSubscription } from './push.service';

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
  constructor(
    private readonly service: NotificationsService,
    private readonly push: PushService,
  ) {}

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

  // ── Web Push (VAPID) ────────────────────────────────────────────────────────
  // Rutas estáticas declaradas ANTES de las `:id` para que no las eclipsen.

  @Get('push/key')
  @ApiOperation({ summary: 'Llave pública VAPID (null si el push no está configurado).' })
  pushKey() {
    return { publicKey: this.push.getPublicKey(), configured: this.push.isConfigured() };
  }

  @Post('push/subscribe')
  @ApiOperation({ summary: 'Registra este navegador para recibir web push.' })
  pushSubscribe(@Req() req: any, @Body() sub: BrowserSubscription) {
    return this.push.subscribe(this.me(req), sub, req.headers?.['user-agent'] ?? null);
  }

  @Post('push/unsubscribe')
  @ApiOperation({ summary: 'Da de baja este navegador del web push.' })
  pushUnsubscribe(@Req() req: any, @Body('endpoint') endpoint: string) {
    return this.push.unsubscribe(this.me(req), endpoint);
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
