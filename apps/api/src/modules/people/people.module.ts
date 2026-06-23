import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Certification } from './entities/certification.entity';
import { SkillCatalog } from './entities/skill-catalog.entity';
import { HrEmployee } from '../hr/entities/hr-employee.entity';
import { PeopleService } from './people.service';
import { PeopleAlertsService } from './people-alerts.service';
import { PeopleAlertsTask } from './people-alerts.task';
import { PeopleController } from './people.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * People / Capital Humano — skills & certifications with expiry alerts.
 * Self-contained additive area (employee denormalized) that consumes the central
 * numbering service for certification folios. Recert alerts (cron + on-demand)
 * drop deduped messages into the per-user mailbox via NotificationsService.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Certification, SkillCatalog, HrEmployee]),
    NumberingModule,
    EventLedgerModule,
    UsersModule,
    NotificationsModule,
  ],
  controllers: [PeopleController],
  providers: [PeopleService, PeopleAlertsService, PeopleAlertsTask],
  exports: [PeopleService, PeopleAlertsService],
})
export class PeopleModule {}
