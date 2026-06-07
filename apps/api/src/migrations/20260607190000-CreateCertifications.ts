import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `certifications` — RH skills & training certifications.
 * Fully additive: brand-new table, every column nullable or defaulted.
 * Idempotent (skips if TypeORM `synchronize` already created it on Railway).
 */
export class CreateCertifications20260607190000 implements MigrationInterface {
  name = 'CreateCertifications20260607190000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('certifications')) return;

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "certifications" (
        "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"       character varying(36),
        "organization_id" character varying(36),
        "plant_id"        character varying(36),
        "folio"           character varying(32),
        "employee_name"   character varying(160) NOT NULL,
        "employee_email"  character varying(200),
        "skill"           character varying(160) NOT NULL,
        "area"            character varying(120),
        "station"         character varying(120),
        "certified_by"    character varying(200),
        "active"          boolean NOT NULL DEFAULT true,
        "issued_date"     TIMESTAMP,
        "expires_date"    TIMESTAMP,
        "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"      TIMESTAMP,
        "created_by"      character varying(255),
        CONSTRAINT "PK_certifications" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_cert_scope_skill" ON "certifications" ("tenant_id", "plant_id", "skill")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_certifications_employee" ON "certifications" ("employee_name")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_certifications_skill" ON "certifications" ("skill")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_certifications_expires" ON "certifications" ("expires_date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('certifications')) {
      await queryRunner.query(`DROP TABLE "certifications"`);
    }
  }
}
