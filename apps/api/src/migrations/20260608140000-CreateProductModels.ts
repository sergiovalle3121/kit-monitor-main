import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `pm_product_models` — the canonical product/model master (NPI).
 * Fully additive: brand-new prefixed table, every column nullable or defaulted.
 * Idempotent (skips if TypeORM `synchronize` already created it on Railway).
 */
export class CreateProductModels20260608140000 implements MigrationInterface {
  name = 'CreateProductModels20260608140000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('pm_product_models')) return;

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "pm_product_models" (
        "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"       character varying(36),
        "organization_id" character varying(36),
        "plant_id"        character varying(36),
        "model_number"    character varying(40) NOT NULL,
        "name"            character varying(200) NOT NULL,
        "customer"        character varying(160),
        "revision"        character varying(20) NOT NULL DEFAULT '1.0',
        "status"          character varying(16) NOT NULL DEFAULT 'DRAFT',
        "description"     text,
        "program_id"      character varying(64),
        "metadata"        text,
        "activated_at"    TIMESTAMP,
        "obsoleted_at"    TIMESTAMP,
        "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"      TIMESTAMP,
        "created_by"      character varying(255),
        CONSTRAINT "PK_pm_product_models" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_pm_models_scope_number" ON "pm_product_models" ("tenant_id", "plant_id", "model_number")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_pm_models_scope_status" ON "pm_product_models" ("tenant_id", "plant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pm_models_number" ON "pm_product_models" ("model_number")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pm_models_program" ON "pm_product_models" ("program_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('pm_product_models')) {
      await queryRunner.query(`DROP TABLE "pm_product_models"`);
    }
  }
}
