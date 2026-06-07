import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `inbound_receipts` — inbound material receipts + IQC.
 * Prefixed table name to avoid clashing with other modules.
 * Fully additive: brand-new table, every column nullable or defaulted.
 * Idempotent (skips if TypeORM `synchronize` already created it on Railway).
 */
export class CreateReceipts20260607210000 implements MigrationInterface {
  name = 'CreateReceipts20260607210000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('inbound_receipts')) return;

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "inbound_receipts" (
        "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"       character varying(36),
        "organization_id" character varying(36),
        "plant_id"        character varying(36),
        "folio"           character varying(32),
        "supplier_name"   character varying(200),
        "po_folio"        character varying(32),
        "part_number"     character varying(80) NOT NULL,
        "description"     character varying(200),
        "quantity"        double precision NOT NULL DEFAULT 0,
        "uom"             character varying(12) NOT NULL DEFAULT 'PCS',
        "lot_number"      character varying(64),
        "serial_number"   character varying(64),
        "date_code"       character varying(32),
        "status"          character varying(12) NOT NULL DEFAULT 'RECEIVED',
        "iqc_result"      character varying(4),
        "reject_code"     character varying(48),
        "received_by"     character varying(200),
        "program_id"      character varying(64),
        "received_at"     TIMESTAMP,
        "released_at"     TIMESTAMP,
        "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"      TIMESTAMP,
        "created_by"      character varying(255),
        CONSTRAINT "PK_inbound_receipts" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_receipt_scope_status" ON "inbound_receipts" ("tenant_id", "plant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inbound_receipts_folio" ON "inbound_receipts" ("folio")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inbound_receipts_part" ON "inbound_receipts" ("part_number")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inbound_receipts_program" ON "inbound_receipts" ("program_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('inbound_receipts')) {
      await queryRunner.query(`DROP TABLE "inbound_receipts"`);
    }
  }
}
