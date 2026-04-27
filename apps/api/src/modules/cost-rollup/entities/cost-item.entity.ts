import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

const decimalToNumber = {
  to: (value: number | null | undefined) => value ?? 0,
  from: (value: string | number | null) => Number(value ?? 0),
};

export enum CostCategory {
  LABOR = 'mano_de_obra',
  MATERIALS = 'materia_prima',
  ENERGY = 'energia',
  OVERHEAD = 'gastos_fijos',
}

@Entity('cost_items')
@Index(['tenantId', 'recordedAt'])
@Index(['tenantId', 'workOrderId'])
@Index(['tenantId', 'category'])
export class CostItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'tenant_id', type: 'varchar', length: 36 })
  tenantId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  workOrderId: string | null;

  @Column({ type: 'varchar', length: 32 })
  category: CostCategory;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 0,
    transformer: decimalToNumber,
  })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'text' })
  description: string;

  @CreateDateColumn({ type: DATE_COLUMN_TYPE })
  recordedAt: Date;
}
