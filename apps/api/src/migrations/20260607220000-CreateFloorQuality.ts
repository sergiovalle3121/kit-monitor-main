import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Block F — Floor quality holds / MRB. Creates `sf_quality_holds`.
 * Fully additive, prefixed table (avoids the legacy quality/ncr tables), all
 * columns nullable/defaulted. Idempotent.
 */
export class CreateFloorQuality20260607220000 implements MigrationInterface {
  name = 'CreateFloorQuality20260607220000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('sf_quality_holds')) return;
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "sf_quality_holds" (
        "id"                uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"         character varying(36),
        "organization_id"   character varying(36),
        "plant_id"          character varying(36),
        "folio"             character varying(32),
        "origin"            character varying(12) NOT NULL DEFAULT 'IN_PROCESS',
        "part"              character varying(64) NOT NULL,
        "qty"               double precision NOT NULL DEFAULT 0,
        "lot"               character varying(64),
        "serial"            character varying(80),
        "wo_id"             character varying(36),
        "wo_folio"          character varying(32),
        "station"           character varying(32),
        "defect_type"       character varying(120),
        "severity"          character varying(8) NOT NULL DEFAULT 'MEDIUM',
        "photo_url"         character varying(512),
        "status"            character varying(16) NOT NULL DEFAULT 'HELD',
        "disposition"       character varying(12),
        "disposition_notes" character varying(500),
        "waiver"            character varying(120),
        "scar_ref"          character varying(120),
        "signed_by"         character varying(200),
        "scrap_qty"         double precision NOT NULL DEFAULT 0,
        "rework_hours"      double precision NOT NULL DEFAULT 0,
        "raised_by"         character varying(200),
        "raised_at"         TIMESTAMP,
        "dispositioned_at"  TIMESTAMP,
        "closed_at"         TIMESTAMP,
        "program_id"        character varying(64),
        "created_at"        TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"        TIMESTAMP,
        "created_by"        character varying(255),
        CONSTRAINT "PK_sf_quality_holds" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_sf_hold_scope_status" ON "sf_quality_holds" ("tenant_id", "plant_id", "status")`);
    await queryRunner.query(`CREATE INDEX "idx_sf_hold_part_lot" ON "sf_quality_holds" ("part", "lot")`);
    await queryRunner.query(`CREATE INDEX "IDX_sf_hold_folio" ON "sf_quality_holds" ("folio")`);
    await queryRunner.query(`CREATE INDEX "IDX_sf_hold_serial" ON "sf_quality_holds" ("serial")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('sf_quality_holds')) {
      await queryRunner.query(`DROP TABLE "sf_quality_holds"`);
    }
  }
}
