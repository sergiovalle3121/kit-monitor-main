import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `test_records` — Test Engineering / yields capture.
 * Fully additive: brand-new table, every column nullable or defaulted.
 * Idempotent (skips if TypeORM `synchronize` already created it on Railway).
 */
export class CreateTestRecords20260607170000 implements MigrationInterface {
  name = 'CreateTestRecords20260607170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('test_records')) return;

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "test_records" (
        "id"                  uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"           character varying(36),
        "organization_id"     character varying(36),
        "plant_id"            character varying(36),
        "folio"               character varying(32),
        "serial_number"       character varying(80) NOT NULL,
        "station"             character varying(12) NOT NULL DEFAULT 'FINAL',
        "result"              character varying(4) NOT NULL DEFAULT 'PASS',
        "model"               character varying(120),
        "failure_code"        character varying(48),
        "failure_description" character varying(255),
        "operator"            character varying(200),
        "program_id"          character varying(64),
        "tested_at"           TIMESTAMP,
        "created_at"          TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"          TIMESTAMP,
        "created_by"          character varying(255),
        CONSTRAINT "PK_test_records" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_testrec_scope_result" ON "test_records" ("tenant_id", "plant_id", "result")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_testrec_serial" ON "test_records" ("tenant_id", "serial_number")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_test_records_folio" ON "test_records" ("folio")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_test_records_failure_code" ON "test_records" ("failure_code")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_test_records_program" ON "test_records" ("program_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('test_records')) {
      await queryRunner.query(`DROP TABLE "test_records"`);
    }
  }
}
