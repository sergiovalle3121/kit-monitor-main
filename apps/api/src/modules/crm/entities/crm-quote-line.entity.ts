import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';

/**
 * A line on a customer quote: a part/model with estimated annual usage (EAU),
 * cost and price. Margin and extended values are computed by the service when
 * the quote is recalculated. Additive table `crm_quote_lines`.
 */
@Entity('crm_quote_lines')
@Index('idx_quoteline_quote', ['tenant_id', 'quote_id'])
export class CrmQuoteLine extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36, name: 'quote_id' })
  quote_id: string;

  @Column({ type: 'int', default: 1, name: 'line_no' })
  lineNo: number;

  @Column({ type: 'varchar', length: 80, nullable: true, name: 'part_number' })
  partNumber: string | null;

  @Column({ type: 'varchar', length: 240 })
  description: string;

  /** Estimated Annual Usage — the volume the customer expects per year. */
  @Column({ type: 'int', default: 0 })
  eau: number;

  /** Quote quantity for this pricing tier (often the EAU or a release qty). */
  @Column({ type: 'float', default: 1 })
  quantity: number;

  @Column({ type: 'float', default: 0, name: 'unit_cost' })
  unitCost: number;

  @Column({ type: 'float', default: 0, name: 'unit_price' })
  unitPrice: number;

  @Column({ type: 'int', nullable: true, name: 'lead_time_days' })
  leadTimeDays: number | null;

  @Column({ type: 'varchar', length: 240, nullable: true })
  notes: string | null;
}
