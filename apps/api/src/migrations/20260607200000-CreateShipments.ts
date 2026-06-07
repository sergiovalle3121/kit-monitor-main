import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `outbound_shipments` — Logistics / outbound (Embarque).
 * Named `outbound_shipments` (not `shipments`) to avoid colliding with the
 * legacy `shipping` module's existing `shipments` table (integer PK).
 * Fully additive: brand-new table, every column nullable or defaulted.
 * Idempotent (skips if TypeORM `synchronize` already created it on Railway).
 */
export class CreateShipments20260607200000 implements MigrationInterface {
  name = 'CreateShipments20260607200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('outbound_shipments')) return;

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "outbound_shipments" (
        "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"       character varying(36),
        "organization_id" character varying(36),
        "plant_id"        character varying(36),
        "folio"           character varying(32),
        "asn"             character varying(32),
        "title"           character varying(200) NOT NULL,
        "customer_name"   character varying(200),
        "destination"     character varying(200),
        "incoterm"        character varying(8) NOT NULL DEFAULT 'DAP',
        "status"          character varying(16) NOT NULL DEFAULT 'PACKING',
        "carrier"         character varying(120),
        "tracking_number" character varying(120),
        "package_count"   integer NOT NULL DEFAULT 0,
        "program_id"      character varying(64),
        "notes"           text,
        "promised_date"   TIMESTAMP,
        "shipped_date"    TIMESTAMP,
        "delivered_date"  TIMESTAMP,
        "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"      TIMESTAMP,
        "created_by"      character varying(255),
        CONSTRAINT "PK_outbound_shipments" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_outbound_scope_status" ON "outbound_shipments" ("tenant_id", "plant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_outbound_shipments_folio" ON "outbound_shipments" ("folio")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_outbound_shipments_asn" ON "outbound_shipments" ("asn")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_outbound_shipments_program" ON "outbound_shipments" ("program_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('outbound_shipments')) {
      await queryRunner.query(`DROP TABLE "outbound_shipments"`);
    }
  }
}
