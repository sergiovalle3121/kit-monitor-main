import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { ErpFinService } from '../services/erp-fin.service';
import { ErpAccount } from '../entities/erp-account.entity';
import { ErpCostCenter } from '../entities/erp-cost-center.entity';
import { ErpPostingRule } from '../entities/erp-posting-rule.entity';
import type { InvoiceKind } from '../entities/erp-invoice.entity';
import type { PaymentMethod } from '../entities/erp-payment.entity';
import type { PostJournalInput } from '../services/erp-fin.service';

type AuthRequest = { user?: { email?: string } };
const actor = (req: AuthRequest) => req?.user?.email ?? 'system';

@ApiTags('ERP · Finanzas (FI/CO)')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('erp/fin')
export class ErpFinController {
  constructor(private readonly fin: ErpFinService) {}

  // Chart of accounts
  @Get('accounts')
  @RequirePermissions('finance:read')
  accounts(@Query('type') type?: string) {
    return this.fin.listAccounts({ type });
  }
  @Post('accounts')
  @RequirePermissions('finance:write')
  upsertAccount(@Body() dto: Partial<ErpAccount>) {
    return this.fin.upsertAccount(dto);
  }

  // Cost centers
  @Get('cost-centers')
  @RequirePermissions('finance:read')
  costCenters() {
    return this.fin.listCostCenters();
  }
  @Post('cost-centers')
  @RequirePermissions('finance:write')
  upsertCostCenter(@Body() dto: Partial<ErpCostCenter>) {
    return this.fin.upsertCostCenter(dto);
  }

  // Posting rules (account determination)
  @Get('posting-rules')
  @RequirePermissions('finance:read')
  rules() {
    return this.fin.listPostingRules();
  }
  @Post('posting-rules')
  @RequirePermissions('finance:write')
  upsertRule(@Body() dto: Partial<ErpPostingRule>) {
    return this.fin.upsertPostingRule(dto);
  }

  // Journals (FIN01 / FB01)
  @Get('journals')
  @RequirePermissions('finance:read')
  journals(
    @Query('period') period?: string,
    @Query('docType') docType?: string,
    @Query('limit') limit?: string,
  ) {
    return this.fin.listJournals({
      period,
      docType,
      limit: limit ? Number(limit) : undefined,
    });
  }
  @Get('journals/:id')
  @RequirePermissions('finance:read')
  journal(@Param('id', ParseIntPipe) id: number) {
    return this.fin.getJournal(id);
  }
  @Post('journals')
  @RequirePermissions('finance:write')
  postJournal(@Body() dto: PostJournalInput, @Request() req: AuthRequest) {
    return this.fin.postJournal({
      ...dto,
      actorName: dto.actorName ?? actor(req),
    });
  }
  @Post('journals/:id/reverse')
  @RequirePermissions('finance:write')
  reverse(@Param('id', ParseIntPipe) id: number, @Request() req: AuthRequest) {
    return this.fin.reverseJournal(id, actor(req));
  }

  // Invoices (FIN02 / SD03)
  @Get('invoices')
  @RequirePermissions('finance:read')
  invoices(
    @Query('kind') kind?: string,
    @Query('status') status?: string,
    @Query('partnerId') partnerId?: string,
  ) {
    return this.fin.listInvoices({ kind, status, partnerId });
  }
  @Get('invoices/:id')
  @RequirePermissions('finance:read')
  invoice(@Param('id', ParseIntPipe) id: number) {
    return this.fin.getInvoice(id);
  }
  @Post('invoices')
  @RequirePermissions('finance:write')
  createInvoice(
    @Body() dto: Parameters<ErpFinService['createInvoice']>[0],
    @Request() req: AuthRequest,
  ) {
    return this.fin.createInvoice({
      ...dto,
      createdBy: dto.createdBy ?? actor(req),
    });
  }
  @Post('invoices/:id/post')
  @RequirePermissions('finance:write')
  postInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthRequest,
  ) {
    return this.fin.postInvoice(id, actor(req));
  }
  @Post('invoices/:id/pay')
  @RequirePermissions('finance:write')
  pay(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    dto: {
      amount: number;
      date?: string;
      method?: PaymentMethod;
      reference?: string;
    },
    @Request() req: AuthRequest,
  ) {
    return this.fin.payInvoice(id, dto, actor(req));
  }

  // Fiscal periods
  @Get('periods')
  @RequirePermissions('finance:read')
  periods() {
    return this.fin.listPeriods();
  }
  @Post('periods/:period/close')
  @RequirePermissions('finance:write')
  closePeriod(@Param('period') period: string, @Request() req: AuthRequest) {
    return this.fin.closePeriod(period, actor(req));
  }
  @Post('periods/:period/open')
  @RequirePermissions('finance:write')
  openPeriod(@Param('period') period: string) {
    return this.fin.openPeriod(period);
  }

  // Reports
  @Get('reports/trial-balance')
  @RequirePermissions('finance:read')
  trialBalance(@Query('period') period?: string) {
    return this.fin.trialBalance(period);
  }
  @Get('reports/general-ledger')
  @RequirePermissions('finance:read')
  generalLedger(
    @Query('account') account: string,
    @Query('period') period?: string,
  ) {
    return this.fin.generalLedger(account, { period });
  }
  @Get('reports/aging')
  @RequirePermissions('finance:read')
  agingReport(@Query('kind') kind: InvoiceKind) {
    return this.fin.aging(kind ?? 'AR');
  }
  @Get('reports/income-statement')
  @RequirePermissions('finance:read')
  incomeStatement(@Query('period') period?: string) {
    return this.fin.incomeStatement(period);
  }
  @Get('reports/balance-sheet')
  @RequirePermissions('finance:read')
  balanceSheet(@Query('period') period?: string) {
    return this.fin.balanceSheet(period);
  }
}
