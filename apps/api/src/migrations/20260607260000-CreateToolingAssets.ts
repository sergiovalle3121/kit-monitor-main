import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `tooling_assets` — molds / fixtures / stencils / gauges (NPI).
 * Fully additive: brand-new table, every column nullable or defaulted.
 * Idempotent (skips if TypeORM `synchronize` already created it on Railway).
 */
export class CreateToolingAssets20260607260000 implements MigrationInterface {
  name = 'CreateToolingAssets20260607260000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('tooling_assets')) return;

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "tooling_assets" (
        "id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"   character varying(36),
        "organization_id" character varying(36),
        "plant_id"    character varying(36),
        "folio"       character varying(32),
        "name"        character varying(160) NOT NULL,
        "type"        character varying(12) NOT NULL DEFAULT 'MOLD',
        "cavities"    integer NOT NULL DEFAULT 1,
        "life_shots"  integer NOT NULL DEFAULT 0,
        "shots_used"  integer NOT NULL DEFAULT 0,
        "status"      character varying(12) NOT NULL DEFAULT 'AVAILABLE',
        "location"    character varying(160),
        "program_id"  character varying(64),
        "created_at"  TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"  TIMESTAMP,
        "created_by"  character varying(255),
        CONSTRAINT "PK_tooling_assets" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_tool_scope_status" ON "tooling_assets" ("tenant_id", "plant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tooling_assets_folio" ON "tooling_assets" ("folio")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tooling_assets_program" ON "tooling_assets" ("program_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('tooling_assets')) {
      await queryRunner.query(`DROP TABLE "tooling_assets"`);
    }
  }
}
