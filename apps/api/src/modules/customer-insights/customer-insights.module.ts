import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerInsightsService } from './customer-insights.service';
import { CustomerInsightsController } from './customer-insights.controller';
import { EnterpriseCustomer } from '../enterprise-campus/entities/enterprise-customer.entity';
import { EnterpriseProgram } from '../enterprise-campus/entities/enterprise-program.entity';
import { CrmAccount } from '../crm/entities/crm-account.entity';
import { Opportunity } from '../crm/entities/opportunity.entity';
import { CrmQuote } from '../crm/entities/crm-quote.entity';
import { RmaCase } from '../rma/entities/rma-case.entity';
import { Shipment } from '../outbound/entities/shipment.entity';
import { ErpSalesOrder } from '../erp-core/entities/erp-sales-order.entity';

/**
 * Customer-360: a read-only aggregation layer that unifies one customer's data
 * across departments (commercial, programs, quality, delivery, finance). Pulls
 * from existing tables — no new schema.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      EnterpriseCustomer,
      EnterpriseProgram,
      CrmAccount,
      Opportunity,
      CrmQuote,
      RmaCase,
      Shipment,
      ErpSalesOrder,
    ]),
  ],
  controllers: [CustomerInsightsController],
  providers: [CustomerInsightsService],
  exports: [CustomerInsightsService],
})
export class CustomerInsightsModule {}
