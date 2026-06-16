import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Changeover / SMED — model-to-model setup events. Creates `sf_changeovers`.
 * Fully additive: brand-new prefixed table, every column nullable or defaulted.
 * Idempotent.
 */
export class CreateChangeovers20260616130000 implements MigrationInterface {
  name = 'CreateChangeovers20260616130000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('sf_changeovers')) return;
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "sf_changeovers" (
        "id"                 uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"          character varying(36),
        "organization_id"    character varying(36),
        "plant_id"           character varying(36),
        "folio"              character varying(32),
        "line"               character varying(32) NOT NULL,
        "from_model"         character varying(64),
        "to_model"           character varying(64),
        "from_wo_id"         character varying(36),
        "to_wo_id"           character varying(36),
        "to_wo_folio"        character varying(32),
        "status"             character varying(16) NOT NULL DEFAULT 'OPEN',
        "checklist"          jsonb,
        "started_at"         TIMESTAMP,
        "completed_at"       TIMESTAMP,
        "duration_sec"       integer,
        "target_minutes"     double precision NOT NULL DEFAULT 0,
        "downtime_category"  character varying(24) NOT NULL DEFAULT 'changeover',
        "downtime_reported"  boolean NOT NULL DEFAULT false,
        "operator"           character varying(200),
        "notes"              character varying(500),
        "program_id"         character varying(64),
        "created_at"         TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"         TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"         TIMESTAMP,
        "created_by"         character varying(255),
        CONSTRAINT "PK_sf_changeovers" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_sf_changeover_scope_status" ON "sf_changeovers" ("tenant_id", "plant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sf_changeover_line" ON "sf_changeovers" ("line", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sf_changeover_folio" ON "sf_changeovers" ("folio")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('sf_changeovers')) {
      await queryRunner.query(`DROP TABLE "sf_changeovers"`);
    }
  }
}
