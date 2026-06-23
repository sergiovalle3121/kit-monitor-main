import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `maintenance_pm_plans` (preventive-maintenance recurrence for the CMMS).
 * Fully additive: brand-new table, every column nullable or defaulted; does not
 * touch `assets` / `maintenance_orders`. Idempotent (skips if TypeORM
 * `synchronize` already materialized it on Railway).
 */
export class CreateMaintenancePmPlans20260623120000
  implements MigrationInterface
{
  name = 'CreateMaintenancePmPlans20260623120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    if (!(await queryRunner.hasTable('maintenance_pm_plans'))) {
      await queryRunner.query(`
        CREATE TABLE "maintenance_pm_plans" (
          "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"       character varying(36),
          "organization_id" character varying(36),
          "plant_id"        character varying(36),
          "asset_id"        character varying(36),
          "asset_name"      character varying(160),
          "title"           character varying(200) NOT NULL,
          "description"     text,
          "frequency_type"  character varying(8) NOT NULL DEFAULT 'DAYS',
          "frequency_value" integer NOT NULL DEFAULT 30,
          "last_done_date"  TIMESTAMP,
          "next_due_date"   TIMESTAMP,
          "active"          boolean NOT NULL DEFAULT true,
          "assigned_to"     character varying(200),
          "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"      TIMESTAMP,
          "created_by"      character varying(255),
          CONSTRAINT "PK_maintenance_pm_plans" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "idx_pm_scope_active" ON "maintenance_pm_plans" ("tenant_id", "plant_id", "active")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_pm_plans_asset" ON "maintenance_pm_plans" ("asset_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_pm_plans_next_due" ON "maintenance_pm_plans" ("next_due_date")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('maintenance_pm_plans')) {
      await queryRunner.query(`DROP TABLE "maintenance_pm_plans"`);
    }
  }
}
