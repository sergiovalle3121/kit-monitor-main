import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Block E — First Article Inspection. Creates `sf_fai`.
 * Fully additive: brand-new prefixed table (avoids the legacy quality inspection
 * tables), every column nullable or defaulted. Idempotent.
 */
export class CreateFai20260616120000 implements MigrationInterface {
  name = 'CreateFai20260616120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('sf_fai')) return;
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "sf_fai" (
        "id"               uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"        character varying(36),
        "organization_id"  character varying(36),
        "plant_id"         character varying(36),
        "folio"            character varying(32),
        "wo_id"            character varying(36) NOT NULL,
        "wo_folio"         character varying(32),
        "model"            character varying(64),
        "revision"         character varying(16) NOT NULL DEFAULT 'A',
        "line"             character varying(32),
        "station"          character varying(32),
        "serial"           character varying(80),
        "result"           character varying(12) NOT NULL DEFAULT 'PENDING',
        "measurements"     jsonb,
        "inspector"        character varying(200),
        "inspected_at"     TIMESTAMP,
        "raised_by"        character varying(200),
        "raised_at"        TIMESTAMP,
        "notes"            character varying(500),
        "program_id"       character varying(64),
        "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"       TIMESTAMP,
        "created_by"       character varying(255),
        CONSTRAINT "PK_sf_fai" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_sf_fai_scope_result" ON "sf_fai" ("tenant_id", "plant_id", "result")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sf_fai_wo" ON "sf_fai" ("wo_id", "result")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sf_fai_folio" ON "sf_fai" ("folio")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sf_fai_model" ON "sf_fai" ("model")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sf_fai_serial" ON "sf_fai" ("serial")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('sf_fai')) {
      await queryRunner.query(`DROP TABLE "sf_fai"`);
    }
  }
}
