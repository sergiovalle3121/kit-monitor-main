import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { JSON_COLUMN_TYPE } from '../../../common/database/json-column-type';

/** A property of an ontology object type (attribute in MicroStrategy terms). */
export interface OntologyProperty {
  name: string;
  type: string;
  description?: string;
}

/**
 * An object type in the semantic **ontology** — the Palantir-style "Object Type"
 * (e.g. WorkOrder, Material, Supplier). It maps a business concept to the data
 * that backs it (`sourceEntity` + `primaryKey`) and declares its salient
 * `properties`, so the platform (and CIDE) share one model of the business.
 */
@Entity('sem_ontology_object')
@Index(['tenantId', 'key'])
export class OntologyObjectType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, default: '__default__' })
  tenantId: string;

  /** Stable key, e.g. `WorkOrder`. */
  @Column({ type: 'varchar', length: 64 })
  key: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  domain: string | null;

  /** Backing data source (table/module key), e.g. `plans`, `ledger_events`. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  sourceEntity: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  primaryKey: string | null;

  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  properties: OntologyProperty[] | null;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
