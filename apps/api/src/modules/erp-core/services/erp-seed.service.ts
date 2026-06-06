import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ErpAccount,
  AccountType,
  NormalBalance,
} from '../entities/erp-account.entity';
import { ErpPostingRule } from '../entities/erp-posting-rule.entity';
import { ErpFiscalPeriod } from '../entities/erp-fiscal-period.entity';

type SeedAccount = [string, string, AccountType, NormalBalance];

/** Default Axos chart of accounts (includes the legacy industrial inventory codes). */
const DEFAULT_ACCOUNTS: SeedAccount[] = [
  ['1000', 'Bancos / Cash', 'asset', 'debit'],
  ['1200', 'Cuentas por Cobrar (AR)', 'asset', 'debit'],
  ['1300', 'IVA Acreditable (Input VAT)', 'asset', 'debit'],
  ['1410', 'Inventario Materia Prima', 'asset', 'debit'],
  ['1420', 'Inventario en Proceso (WIP)', 'asset', 'debit'],
  ['1430', 'Inventario Producto Terminado', 'asset', 'debit'],
  ['2100', 'Cuentas por Pagar (AP)', 'liability', 'credit'],
  ['2150', 'GR/IR Clearing', 'liability', 'credit'],
  ['2190', 'Inventory Clearing', 'liability', 'credit'],
  ['2200', 'IVA Trasladado (Output VAT)', 'liability', 'credit'],
  ['3000', 'Capital Social', 'equity', 'credit'],
  ['3900', 'Resultado del Ejercicio', 'equity', 'credit'],
  ['4000', 'Ventas', 'revenue', 'credit'],
  ['5000', 'Costo de Ventas (COGS)', 'expense', 'debit'],
  ['5110', 'Consumo de Producción', 'expense', 'debit'],
  ['5150', 'Gasto por Merma (Scrap)', 'expense', 'debit'],
  ['5190', 'Ajuste de Inventario', 'expense', 'debit'],
  ['5900', 'Variación de Precio', 'expense', 'debit'],
];

type SeedRule = [string, string, string, string, string | null];

/** event, description, debitCode, creditCode, taxCode */
const DEFAULT_RULES: SeedRule[] = [
  [
    'GOODS_RECEIPT',
    'Recepción de compra → Inventario vs GR/IR',
    '1410',
    '2150',
    null,
  ],
  [
    'AP_INVOICE',
    'Factura proveedor → GR/IR vs CxP (+IVA acreditable)',
    '2150',
    '2100',
    '1300',
  ],
  [
    'GOODS_ISSUE',
    'Consumo a producción → Consumo vs Inventario',
    '5110',
    '1410',
    null,
  ],
  [
    'PRODUCTION_COMPLETION',
    'Cierre de producción → PT vs WIP',
    '1430',
    '1420',
    null,
  ],
  ['WIP_ISSUE', 'Material a WIP → WIP vs Inventario', '1420', '1410', null],
  [
    'SALES_INVOICE',
    'Factura cliente → CxC vs Ventas (+IVA trasladado)',
    '1200',
    '4000',
    '2200',
  ],
  ['COGS', 'Costo de ventas → COGS vs Inventario PT', '5000', '1430', null],
  ['AR_PAYMENT', 'Cobro cliente → Bancos vs CxC', '1000', '1200', null],
  ['AP_PAYMENT', 'Pago proveedor → CxP vs Bancos', '2100', '1000', null],
  [
    'INVENTORY_ADJUSTMENT',
    'Ajuste de inventario → Ajuste vs Inventario',
    '5190',
    '1410',
    null,
  ],
  ['SCRAP', 'Merma → Gasto merma vs Inventario', '5150', '1410', null],
  [
    'PRICE_VARIANCE',
    'Variación de precio → Variación vs GR/IR',
    '5900',
    '2150',
    null,
  ],
];

@Injectable()
export class ErpSeedService implements OnModuleInit {
  private readonly logger = new Logger(ErpSeedService.name);

  constructor(
    @InjectRepository(ErpAccount)
    private readonly accountRepo: Repository<ErpAccount>,
    @InjectRepository(ErpPostingRule)
    private readonly ruleRepo: Repository<ErpPostingRule>,
    @InjectRepository(ErpFiscalPeriod)
    private readonly periodRepo: Repository<ErpFiscalPeriod>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.seedAccounts();
      await this.seedRules();
      await this.ensureCurrentPeriod();
    } catch (err) {
      this.logger.error('ERP seed failed', err as Error);
    }
  }

  private async seedAccounts(): Promise<void> {
    const codes = DEFAULT_ACCOUNTS.map((a) => a[0]);
    const existing = await this.accountRepo.find({
      where: { code: In(codes) },
    });
    const have = new Set(existing.map((a) => a.code));
    const missing = DEFAULT_ACCOUNTS.filter(([code]) => !have.has(code)).map(
      ([code, name, type, normalBalance]) =>
        this.accountRepo.create({ code, name, type, normalBalance }),
    );
    if (missing.length) {
      await this.accountRepo.save(missing);
      this.logger.log(`Seeded ${missing.length} GL accounts`);
    }
  }

  private async seedRules(): Promise<void> {
    const events = DEFAULT_RULES.map((r) => r[0]);
    const existing = await this.ruleRepo.find({ where: { event: In(events) } });
    const have = new Set(existing.map((r) => r.event));
    const missing = DEFAULT_RULES.filter(([event]) => !have.has(event)).map(
      ([event, description, debitCode, creditCode, taxCode]) =>
        this.ruleRepo.create({
          event,
          description,
          debitCode,
          creditCode,
          taxCode,
        }),
    );
    if (missing.length) {
      await this.ruleRepo.save(missing);
      this.logger.log(`Seeded ${missing.length} posting rules`);
    }
  }

  private async ensureCurrentPeriod(): Promise<void> {
    const period = new Date().toISOString().slice(0, 7); // YYYY-MM
    const existing = await this.periodRepo.findOne({ where: { period } });
    if (!existing) {
      await this.periodRepo.save(
        this.periodRepo.create({ period, status: 'open' }),
      );
    }
  }
}
