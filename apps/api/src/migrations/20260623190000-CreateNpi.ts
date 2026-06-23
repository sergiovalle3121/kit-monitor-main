import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NPI phase-gate foundation. Creates `npi_project` and `npi_gate`.
 *
 * Fully additive: brand-new prefixed tables (`npi_`), every column nullable or
 * defaulted, and references to existing data (model number, project id) are
 * plain varchars with NO foreign-key constraints — so it never alters or couples
 * to product-models, BOM, FAI, line-engineering or suppliers. Idempotent.
 */
export class CreateNpi20260623190000 implements MigrationInterface {
  name = 'CreateNpi20260623190000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    if (!(await queryRunner.hasTable('npi_project'))) {
      await queryRunner.query(`
        CREATE TABLE "npi_project" (
          "id"               uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"        character varying(36),
          "organization_id"  character varying(36),
          "plant_id"         character varying(36),
          "model_number"     character varying(40) NOT NULL,
          "revision"         character varying(20) NOT NULL DEFAULT '1.0',
          "customer"         character varying(160),
          "current_phase"    character varying(16) NOT NULL DEFAULT 'QUOTE',
          "status"           character varying(16) NOT NULL DEFAULT 'OPEN',
          "program_id"       character varying(64),
          "notes"            character varying(500),
          "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"       TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"       TIMESTAMP,
          "created_by"       character varying(255),
          CONSTRAINT "PK_npi_project" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE UNIQUE INDEX "uq_npi_project_scope_model_rev" ON "npi_project" ("tenant_id", "plant_id", "model_number", "revision")`,
      );
      await queryRunner.query(
        `CREATE INDEX "idx_npi_project_scope_status" ON "npi_project" ("tenant_id", "plant_id", "status")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_npi_project_model" ON "npi_project" ("model_number")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_npi_project_program" ON "npi_project" ("program_id")`,
      );
    }

    if (!(await queryRunner.hasTable('npi_gate'))) {
      await queryRunner.query(`
        CREATE TABLE "npi_gate" (
          "id"               uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"        character varying(36),
          "organization_id"  character varying(36),
          "plant_id"         character varying(36),
          "project_id"       character varying(36) NOT NULL,
          "phase"            character varying(16) NOT NULL,
          "status"           character varying(16) NOT NULL DEFAULT 'PENDING',
          "decided_by_email" character varying(200),
          "decided_at"       TIMESTAMP,
          "notes"            character varying(500),
          "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"       TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"       TIMESTAMP,
          "created_by"       character varying(255),
          CONSTRAINT "PK_npi_gate" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "idx_npi_gate_scope_project" ON "npi_gate" ("tenant_id", "plant_id", "project_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "idx_npi_gate_project_phase" ON "npi_gate" ("project_id", "phase")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('npi_gate')) {
      await queryRunner.query(`DROP TABLE "npi_gate"`);
    }
    if (await queryRunner.hasTable('npi_project')) {
      await queryRunner.query(`DROP TABLE "npi_project"`);
    }
  }
}
