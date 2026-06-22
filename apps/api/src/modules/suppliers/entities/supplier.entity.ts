import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('suppliers')
export class Supplier {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32, unique: true })
  @Index()
  code: string; // Supplier ID / Vendor Code

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  country?: string;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: string; // active, inactive, restricted

  @Column({ type: 'float', default: 100 })
  qualityScore: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  // ── Supplier master enrichment (additive, supply-chain depth) ──
  @Column({ type: 'varchar', length: 160, nullable: true })
  legalName?: string;

  /** COMPONENT | CONTRACT | SERVICE | DISTRIBUTOR | RAW_MATERIAL. */
  @Column({ type: 'varchar', length: 24, default: 'COMPONENT' })
  type: string;

  /** Commodity / category, e.g. "Pasivos", "Semiconductores", "Conectores". */
  @Column({ type: 'varchar', length: 80, nullable: true })
  commodity?: string;

  /** APPROVED | CONDITIONAL | PENDING | DISQUALIFIED. */
  @Column({ type: 'varchar', length: 16, default: 'PENDING', name: 'qualification_status' })
  qualificationStatus: string;

  @Column({ type: 'varchar', length: 24, nullable: true })
  region?: string; // NAM | LATAM | EMEA | APAC

  @Column({ type: 'varchar', length: 80, nullable: true })
  city?: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  website?: string;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', length: 24, nullable: true, name: 'payment_terms' })
  paymentTerms?: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  incoterm?: string;

  @Column({ type: 'int', nullable: true, name: 'lead_time_days' })
  leadTimeDays?: number;

  /** On-time delivery %, last rolling window. */
  @Column({ type: 'float', nullable: true, name: 'otd_pct' })
  otdPct?: number;

  /** Defective parts per million (incoming quality). */
  @Column({ type: 'int', nullable: true })
  ppm?: number;

  /** 0–100 responsiveness/communication score. */
  @Column({ type: 'float', nullable: true, name: 'responsiveness_score' })
  responsivenessScore?: number;

  /** LOW | MEDIUM | HIGH composite supply risk. */
  @Column({ type: 'varchar', length: 12, default: 'LOW', name: 'risk_level' })
  riskLevel: string;

  /** STRONG | STABLE | WATCH | DISTRESSED financial health signal. */
  @Column({ type: 'varchar', length: 16, nullable: true, name: 'financial_health' })
  financialHealth?: string;

  /** Sole-source dependency flag (single point of failure). */
  @Column({ type: 'boolean', default: false, name: 'single_source' })
  singleSource: boolean;

  /** Owning SQE / buyer email. */
  @Column({ type: 'varchar', length: 200, nullable: true, name: 'owner_email' })
  ownerEmail?: string;

  @Column({ type: 'varchar', length: 40, nullable: true, name: 'tax_id' })
  taxId?: string;

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
