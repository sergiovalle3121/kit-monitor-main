import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `purchase_orders` — Procurement / purchasing.
 * Fully additive: brand-new table, every column nullable or defaulted.
 * Idempotent (skips if TypeORM `synchronize` already created it on Railway).
 */
export class CreatePurchaseOrders20260607180000 implements MigrationInterface {
  name = 'CreatePurchaseOrders20260607180000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('purchase_orders')) return;

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "purchase_orders" (
        "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"       character varying(36),
        "organization_id" character varying(36),
        "plant_id"        character varying(36),
        "folio"           character varying(32),
        "title"           character varying(200) NOT NULL,
        "supplier_name"   character varying(200),
        "supplier_id"     character varying(64),
        "status"          character varying(16) NOT NULL DEFAULT 'DRAFT',
        "priority"        character varying(8) NOT NULL DEFAULT 'MEDIUM',
        "total_value"     double precision NOT NULL DEFAULT 0,
        "currency"        character varying(3) NOT NULL DEFAULT 'USD',
        "buyer"           character varying(200),
        "program_id"      character varying(64),
        "notes"           text,
        "issued_at"       TIMESTAMP,
        "required_date"   TIMESTAMP,
        "promised_date"   TIMESTAMP,
        "received_date"   TIMESTAMP,
        "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"      TIMESTAMP,
        "created_by"      character varying(255),
        CONSTRAINT "PK_purchase_orders" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_po_scope_status" ON "purchase_orders" ("tenant_id", "plant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_purchase_orders_folio" ON "purchase_orders" ("folio")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_purchase_orders_program" ON "purchase_orders" ("program_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('purchase_orders')) {
      await queryRunner.query(`DROP TABLE "purchase_orders"`);
    }
  }
}
