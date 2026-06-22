import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Opportunity } from './entities/opportunity.entity';
import { CrmAccount } from './entities/crm-account.entity';
import { CrmContact } from './entities/crm-contact.entity';
import { CrmActivity } from './entities/crm-activity.entity';
import { CrmQuote } from './entities/crm-quote.entity';
import { CrmQuoteLine } from './entities/crm-quote-line.entity';
import { CrmService } from './crm.service';
import { CrmController } from './crm.controller';
import { AccountsService } from './services/accounts.service';
import { ContactsService } from './services/contacts.service';
import { ActivitiesService } from './services/activities.service';
import { QuotesService } from './services/quotes.service';
import { AccountsController } from './accounts.controller';
import { ContactsController } from './contacts.controller';
import { ActivitiesController } from './activities.controller';
import { QuotesController } from './quotes.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';

/**
 * CRM / Commercial suite for the EMS front door. Accounts (customer 360),
 * contacts (buying center), opportunities (pipeline), quotes (RFQ→Quote with
 * line items + margin) and the activity timeline. Additive tables; consumes the
 * central numbering service for OPP- / QT- folios and writes to the Event Ledger.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Opportunity,
      CrmAccount,
      CrmContact,
      CrmActivity,
      CrmQuote,
      CrmQuoteLine,
    ]),
    NumberingModule,
    EventLedgerModule,
  ],
  controllers: [
    CrmController,
    AccountsController,
    ContactsController,
    ActivitiesController,
    QuotesController,
  ],
  providers: [
    CrmService,
    AccountsService,
    ContactsService,
    ActivitiesService,
    QuotesService,
  ],
  exports: [CrmService, AccountsService, ContactsService, QuotesService, ActivitiesService],
})
export class CrmModule {}
