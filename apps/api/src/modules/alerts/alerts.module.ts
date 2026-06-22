import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Plan } from '../plans/entities/plan.entity';
import { PlansModule } from '../plans/plans.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { AlertsService } from './alerts.service';
import { AlertsTask } from './alerts.task';

/**
 * Motor de alertas (autocontenido). Reusa la readiness de PlansService, el buzón
 * de NotificationsService y la resolución de dueño de UsersService; no aporta
 * entidades ni migraciones propias. El `ScheduleModule.forRoot()` global (en
 * AppModule) ya habilita el `@Cron` de AlertsTask.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Plan]),
    PlansModule,
    NotificationsModule,
    UsersModule,
  ],
  providers: [AlertsService, AlertsTask],
  exports: [AlertsService],
})
export class AlertsModule {}
