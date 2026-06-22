import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserNotification } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { SignalModule } from '../../common/gateway/signal.module';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

/**
 * Buzón de notificaciones por-usuario (persistente). Self-contained y aditivo:
 * tabla propia `user_notifications`, tenant-scoped, con push best-effort por el
 * gateway de señales del tenant (SignalModule). Lo consumen el seed y, a futuro,
 * los productores de eventos del piso.
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserNotification]), SignalModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, provideTenantScopedRepository(UserNotification)],
  exports: [NotificationsService],
})
export class NotificationsModule {}
