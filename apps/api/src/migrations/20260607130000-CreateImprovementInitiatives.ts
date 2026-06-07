import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `improvement_initiatives` — continuous-improvement / OpEx (Kaizen).
 * Fully additive: brand-new table, every column nullable or defaulted.
 * Idempotent (skips if TypeORM `synchronize` already created it on Railway).
 */
export class CreateImprovementInitiatives20260607130000
  implements MigrationInterface
{
  name = 'CreateImprovementInitiatives20260607130000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('improvement_initiatives')) return;

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "improvement_initiatives" (
        "id"                uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"         character varying(36),
        "organization_id"   character varying(36),
        "plant_id"          character varying(36),
        "folio"             character varying(32),
        "title"             character varying(200) NOT NULL,
        "description"       text,
        "methodology"       character varying(16) NOT NULL DEFAULT 'KAIZEN',
        "status"            character varying(16) NOT NULL DEFAULT 'DRAFT',
        "priority"          character varying(8) NOT NULL DEFAULT 'MEDIUM',
        "area"              character varying(120),
        "program_id"        character varying(64),
        "owner_email"       character varying(200),
        "estimated_savings" double precision NOT NULL DEFAULT 0,
        "actual_savings"    double precision NOT NULL DEFAULT 0,
        "currency"          character varying(3) NOT NULL DEFAULT 'USD',
        "started_at"        TIMESTAMP,
        "implemented_at"    TIMESTAMP,
        "verified_at"       TIMESTAMP,
        "closed_at"         TIMESTAMP,
        "created_at"        TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"        TIMESTAMP,
        "created_by"        character varying(255),
        CONSTRAINT "PK_improvement_initiatives" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_improvement_scope_status" ON "improvement_initiatives" ("tenant_id", "plant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_improvement_initiatives_folio" ON "improvement_initiatives" ("folio")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_improvement_initiatives_program" ON "improvement_initiatives" ("program_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('improvement_initiatives')) {
      await queryRunner.query(`DROP TABLE "improvement_initiatives"`);
    }
  }
}
