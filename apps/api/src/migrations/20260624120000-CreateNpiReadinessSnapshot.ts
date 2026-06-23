import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NPI readiness history. Creates `npi_readiness_snapshot`.
 *
 * Fully additive: brand-new prefixed table (`npi_`), every column nullable or
 * defaulted, references by id/number are plain varchars with NO foreign-key
 * constraints. Idempotent.
 */
export class CreateNpiReadinessSnapshot20260624120000 implements MigrationInterface {
  name = 'CreateNpiReadinessSnapshot20260624120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('npi_readiness_snapshot')) return;
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "npi_readiness_snapshot" (
        "id"               uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"        character varying(36),
        "organization_id"  character varying(36),
        "plant_id"         character varying(36),
        "project_id"       character varying(36),
        "model_number"     character varying(40) NOT NULL,
        "revision"         character varying(20) NOT NULL DEFAULT '1.0',
        "phase"            character varying(16),
        "reason"           character varying(24) NOT NULL DEFAULT 'MANUAL',
        "gate_ready"       boolean NOT NULL DEFAULT false,
        "ready_count"      integer NOT NULL DEFAULT 0,
        "not_ready_count"  integer NOT NULL DEFAULT 0,
        "unknown_count"    integer NOT NULL DEFAULT 0,
        "criteria"         jsonb,
        "signals"          jsonb,
        "blockers"         jsonb,
        "note"             character varying(500),
        "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"       TIMESTAMP,
        "created_by"       character varying(255),
        CONSTRAINT "PK_npi_readiness_snapshot" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_npi_snapshot_scope_model" ON "npi_readiness_snapshot" ("tenant_id", "plant_id", "model_number", "revision")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_npi_snapshot_project" ON "npi_readiness_snapshot" ("project_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_npi_snapshot_model" ON "npi_readiness_snapshot" ("model_number")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('npi_readiness_snapshot')) {
      await queryRunner.query(`DROP TABLE "npi_readiness_snapshot"`);
    }
  }
}
