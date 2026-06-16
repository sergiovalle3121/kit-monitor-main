import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Block I — Genealogy / cradle-to-grave traceability. Creates the additive index
 * `sf_genealogy_index` (built serial → consumed lot/reel of each NP, with
 * operator/station/timestamp) and `sf_genealogy_shipment` (serial → shipment for
 * recall containment). Fully additive, prefixed tables, all columns
 * nullable/defaulted on brand-new tables; idempotent. Never touches the source
 * consumption tables.
 */
export class CreateGenealogy20260616000000 implements MigrationInterface {
  name = 'CreateGenealogy20260616000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    if (!(await queryRunner.hasTable('sf_genealogy_index'))) {
      await queryRunner.query(`
        CREATE TABLE "sf_genealogy_index" (
          "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"       character varying(36),
          "organization_id" character varying(36),
          "plant_id"        character varying(36),
          "idempotency_key" character varying(160) NOT NULL,
          "built_serial"    character varying(80) NOT NULL,
          "parent_serial"   character varying(80),
          "part"            character varying(64) NOT NULL,
          "lot"             character varying(80),
          "reel"            character varying(80),
          "qty"             double precision NOT NULL DEFAULT 0,
          "wo_id"           character varying(36),
          "wo_folio"        character varying(32),
          "model"           character varying(64),
          "station"         character varying(32),
          "operator_email"  character varying(200),
          "consumed_at"     TIMESTAMP,
          "source"          character varying(24) NOT NULL DEFAULT 'MANUAL',
          "source_event_id" character varying(80),
          "program_id"      character varying(64),
          "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"      TIMESTAMP,
          "created_by"      character varying(255),
          CONSTRAINT "PK_sf_genealogy_index" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_sf_genealogy_index_idem" UNIQUE ("idempotency_key")
        )
      `);
      await queryRunner.query(`CREATE INDEX "idx_sf_geni_scope" ON "sf_genealogy_index" ("tenant_id", "plant_id")`);
      await queryRunner.query(`CREATE INDEX "idx_sf_geni_part_lot" ON "sf_genealogy_index" ("part", "lot")`);
      await queryRunner.query(`CREATE INDEX "IDX_sf_geni_built_serial" ON "sf_genealogy_index" ("built_serial")`);
      await queryRunner.query(`CREATE INDEX "IDX_sf_geni_parent_serial" ON "sf_genealogy_index" ("parent_serial")`);
      await queryRunner.query(`CREATE INDEX "IDX_sf_geni_part" ON "sf_genealogy_index" ("part")`);
      await queryRunner.query(`CREATE INDEX "IDX_sf_geni_lot" ON "sf_genealogy_index" ("lot")`);
      await queryRunner.query(`CREATE INDEX "IDX_sf_geni_reel" ON "sf_genealogy_index" ("reel")`);
    }

    if (!(await queryRunner.hasTable('sf_genealogy_shipment'))) {
      await queryRunner.query(`
        CREATE TABLE "sf_genealogy_shipment" (
          "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"       character varying(36),
          "organization_id" character varying(36),
          "plant_id"        character varying(36),
          "idempotency_key" character varying(160) NOT NULL,
          "built_serial"    character varying(80) NOT NULL,
          "shipment_id"     character varying(36),
          "shipment_folio"  character varying(32),
          "asn"             character varying(32),
          "customer_name"   character varying(200),
          "destination"     character varying(200),
          "shipped_at"      TIMESTAMP,
          "program_id"      character varying(64),
          "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"      TIMESTAMP,
          "created_by"      character varying(255),
          CONSTRAINT "PK_sf_genealogy_shipment" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_sf_genealogy_shipment_idem" UNIQUE ("idempotency_key")
        )
      `);
      await queryRunner.query(`CREATE INDEX "idx_sf_gens_scope" ON "sf_genealogy_shipment" ("tenant_id", "plant_id")`);
      await queryRunner.query(`CREATE INDEX "IDX_sf_gens_built_serial" ON "sf_genealogy_shipment" ("built_serial")`);
      await queryRunner.query(`CREATE INDEX "IDX_sf_gens_shipment_id" ON "sf_genealogy_shipment" ("shipment_id")`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('sf_genealogy_shipment')) {
      await queryRunner.query(`DROP TABLE "sf_genealogy_shipment"`);
    }
    if (await queryRunner.hasTable('sf_genealogy_index')) {
      await queryRunner.query(`DROP TABLE "sf_genealogy_index"`);
    }
  }
}
