import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Packing (Empaque) — handling units (pallet/carton) with GS1 SSCC for the EMS
 * shipping suite. Additive, prefixed, tenant-scoped table
 * `packing_handling_units`. Idempotent (hasTable guard); references shipments by
 * id (no FK). `contents` is portable JSON stored as text (SQLite + Postgres).
 */
export class CreatePacking20260616150000 implements MigrationInterface {
  name = 'CreatePacking20260616150000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    if (!(await queryRunner.hasTable('packing_handling_units'))) {
      await queryRunner.query(`
        CREATE TABLE "packing_handling_units" (
          "id"               uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"        character varying(36),
          "organization_id"  character varying(36),
          "plant_id"         character varying(36),
          "shipment_id"      character varying(36),
          "shipment_folio"   character varying(32),
          "sscc"             character varying(18),
          "sscc_placeholder" boolean NOT NULL DEFAULT false,
          "type"             character varying(16) NOT NULL DEFAULT 'CARTON',
          "parent_id"        character varying(36),
          "status"           character varying(16) NOT NULL DEFAULT 'OPEN',
          "weight_kg"        double precision,
          "length_cm"        double precision,
          "width_cm"         double precision,
          "height_cm"        double precision,
          "contents"         text,
          "ship_to_name"     character varying(200),
          "ship_to_address"  character varying(200),
          "from_name"        character varying(200),
          "po_number"        character varying(64),
          "notes"            text,
          "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"       TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"       TIMESTAMP,
          "created_by"       character varying(255),
          CONSTRAINT "PK_packing_handling_units" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(`CREATE INDEX "idx_packing_hu_scope" ON "packing_handling_units" ("tenant_id", "plant_id")`);
      await queryRunner.query(`CREATE INDEX "IDX_packing_hu_sscc" ON "packing_handling_units" ("sscc")`);
      await queryRunner.query(`CREATE INDEX "IDX_packing_hu_shipment" ON "packing_handling_units" ("shipment_id")`);
      await queryRunner.query(`CREATE INDEX "IDX_packing_hu_parent" ON "packing_handling_units" ("parent_id")`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('packing_handling_units')) {
      await queryRunner.query(`DROP TABLE "packing_handling_units"`);
    }
  }
}
