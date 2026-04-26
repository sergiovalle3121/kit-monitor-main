import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import { JSON_COLUMN_TYPE } from '../../../common/database/json-column-type';

const decimalToNumber = {
  to: (value: number | null | undefined) => value ?? 0,
  from: (value: string | number | null) => Number(value ?? 0),
};

export enum TransactionDirection {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

export enum TransactionSourceType {
  INVENTORY_MOVEMENT = 'INVENTORY_MOVEMENT',
  PRODUCTION_COMPLETION = 'PRODUCTION_COMPLETION',
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT',
}

export enum TransactionCostBasis {
  ACTUAL = 'ACTUAL',
  MATERIAL_MASTER = 'MATERIAL_MASTER',
  BOM_ROLLUP = 'BOM_ROLLUP',
  ZERO_COST = 'ZERO_COST',
}

export enum IndustrialAccountCode {
  RAW_MATERIAL_INVENTORY = '1410',
  WIP_INVENTORY = '1420',
  FINISHED_GOODS_INVENTORY = '1430',
  INVENTORY_CLEARING = '2190',
  PRODUCTION_CONSUMPTION = '5110',
  INVENTORY_ADJUSTMENT = '5190',
  SCRAP_EXPENSE = '5150',
}

@Entity('transactions')
@Index(['tenant_id', 'postedAt'])
@Index(['tenant_id', 'sourceType', 'sourceId'])
@Index(['journalId'])
@Index(['workOrder'])
@Index(['materialPartNumber'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({
    type: 'varchar',
    length: 36,
    nullable: true,
    name: 'organization_id',
  })
  organization_id: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'plant_id' })
  plant_id: string | null;

  @Column({ type: 'varchar', length: 64 })
  journalId: string;

  @Column({ type: 'int' })
  lineNumber: number;

  @Column({ type: 'varchar', length: 16 })
  direction: TransactionDirection;

  @Column({ type: 'varchar', length: 24 })
  accountCode: string;

  @Column({ type: 'varchar', length: 120 })
  accountName: string;

  @Column({ type: 'varchar', length: 40 })
  sourceType: TransactionSourceType;

  @Column({ type: 'varchar', length: 120 })
  sourceId: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  referenceType?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  referenceId?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  materialPartNumber?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  workOrder?: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  warehouseId?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  location?: string | null;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
    transformer: decimalToNumber,
  })
  quantity: number;

  @Column({ type: 'varchar', length: 20, default: 'EA' })
  uom: string;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
    transformer: decimalToNumber,
  })
  actualUnitCost: number;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
    transformer: decimalToNumber,
  })
  actualTotalCost: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', length: 32 })
  costBasis: TransactionCostBasis;

  @Column({ type: 'varchar', length: 120, nullable: true })
  actorName?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string | null;

  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ type: DATE_COLUMN_TYPE })
  postedAt: Date;
}
