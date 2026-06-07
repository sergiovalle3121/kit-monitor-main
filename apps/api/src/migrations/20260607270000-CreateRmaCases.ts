import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `rma_cases` — customer complaints / returns (Quality).
 * Fully additive: brand-new table, every column nullable or defaulted.
 * Idempotent (skips if TypeORM `synchronize` already created it on Railway).
 */
export class CreateRmaCases20260607270000 implements MigrationInterface {
  name = 'CreateRmaCases20260607270000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('rma_cases')) return;

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "rma_cases" (
        "id"                  uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"           character varying(36),
        "organization_id"     character varying(36),
        "plant_id"            character varying(36),
        "folio"               character varying(32),
        "customer_name"       character varying(200),
        "part_number"         character varying(80),
        "serial_number"       character varying(80),
        "failure_description" character varying(255) NOT NULL,
        "severity"            character varying(12) NOT NULL DEFAULT 'MEDIUM',
        "status"              character varying(16) NOT NULL DEFAULT 'OPEN',
        "disposition"         character varying(12),
        "root_cause"          text,
        "quantity"            integer NOT NULL DEFAULT 1,
        "program_id"          character varying(64),
        "opened_at"           TIMESTAMP,
        "closed_at"           TIMESTAMP,
        "created_at"          TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"          TIMESTAMP,
        "created_by"          character varying(255),
        CONSTRAINT "PK_rma_cases" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_rma_scope_status" ON "rma_cases" ("tenant_id", "plant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rma_cases_folio" ON "rma_cases" ("folio")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rma_cases_part" ON "rma_cases" ("part_number")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rma_cases_program" ON "rma_cases" ("program_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('rma_cases')) {
      await queryRunner.query(`DROP TABLE "rma_cases"`);
    }
  }
}
