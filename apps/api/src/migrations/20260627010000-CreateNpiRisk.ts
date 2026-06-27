import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NPI risk register. Creates `npi_risk` — an additive, advisory table.
 *
 * Brand-new prefixed table (`npi_`); links to its project by id (plain varchar,
 * NO foreign-key constraint) so it never couples to other tables. Idempotent.
 */
export class CreateNpiRisk20260627010000 implements MigrationInterface {
  name = 'CreateNpiRisk20260627010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    if (!(await queryRunner.hasTable('npi_risk'))) {
      await queryRunner.query(`
        CREATE TABLE "npi_risk" (
          "id"               uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"        character varying(36),
          "organization_id"  character varying(36),
          "plant_id"         character varying(36),
          "project_id"       character varying(36) NOT NULL,
          "title"            character varying(200) NOT NULL,
          "description"      character varying(1000),
          "severity"         character varying(16) NOT NULL DEFAULT 'MEDIUM',
          "status"           character varying(16) NOT NULL DEFAULT 'OPEN',
          "owner"            character varying(200),
          "due_date"         TIMESTAMP,
          "mitigation"       character varying(1000),
          "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"       TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"       TIMESTAMP,
          "created_by"       character varying(255),
          CONSTRAINT "PK_npi_risk" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "idx_npi_risk_scope_project" ON "npi_risk" ("tenant_id", "plant_id", "project_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "idx_npi_risk_project_status" ON "npi_risk" ("project_id", "status")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_npi_risk_project" ON "npi_risk" ("project_id")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('npi_risk')) {
      await queryRunner.query(`DROP TABLE "npi_risk"`);
    }
  }
}
