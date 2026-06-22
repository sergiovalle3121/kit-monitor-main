import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A relationship between two ontology object types — the Palantir-style "Link
 * Type" (e.g. WorkOrder —consumes→ Material). Together with object types, links
 * form the graph CIDE and dashboards reason over.
 */
@Entity('sem_ontology_link')
@Index(['tenantId', 'key'])
export class OntologyLinkType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, default: '__default__' })
  tenantId: string;

  /** Stable key, e.g. `wo_consumes_material`. */
  @Column({ type: 'varchar', length: 80 })
  key: string;

  /** Object type key the link starts from, e.g. `WorkOrder`. */
  @Column({ type: 'varchar', length: 64 })
  fromObject: string;

  /** Object type key the link points to, e.g. `Material`. */
  @Column({ type: 'varchar', length: 64 })
  toObject: string;

  /** `one_to_one` | `one_to_many` | `many_to_one` | `many_to_many`. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  cardinality: string | null;

  /** Verb describing the relationship, e.g. `consumes`. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  verb: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
