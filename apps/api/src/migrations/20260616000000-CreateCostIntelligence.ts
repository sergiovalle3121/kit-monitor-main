import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Block M — Cost intelligence (floor↔money). Creates `fin_wo_cost_snapshot`.
 * Fully additive, prefixed table (avoids the legacy cost_items / accounting
 * tables), every column nullable or defaulted. Idempotent: a no-op when the
 * table already exists (prod materializes the schema via synchronize).
 */
export class CreateCostIntelligence20260616000000 implements MigrationInterface {
  name = 'CreateCostIntelligence20260616000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('fin_wo_cost_snapshot')) return;
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "fin_wo_cost_snapshot" (
        "id"                      uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"               character varying(36),
        "organization_id"         character varying(36),
        "plant_id"                character varying(36),
        "period"                  character varying(7) NOT NULL,
        "wo_id"                   character varying(36) NOT NULL,
        "wo_folio"                character varying(32),
        "model"                   character varying(64),
        "line"                    character varying(32),
        "program_id"              character varying(64),
        "customer"                character varying(200),
        "wo_status"               character varying(16),
        "quantity_planned"        integer NOT NULL DEFAULT 0,
        "quantity_completed"      integer NOT NULL DEFAULT 0,
        "material_plan_cost"      double precision NOT NULL DEFAULT 0,
        "material_actual_cost"    double precision NOT NULL DEFAULT 0,
        "material_usage_variance" double precision NOT NULL DEFAULT 0,
        "labor_cost"              double precision NOT NULL DEFAULT 0,
        "overhead_cost"           double precision NOT NULL DEFAULT 0,
        "scrap_qty"               double precision NOT NULL DEFAULT 0,
        "scrap_cost"              double precision NOT NULL DEFAULT 0,
        "cogs"                    double precision NOT NULL DEFAULT 0,
        "unit_cost"               double precision NOT NULL DEFAULT 0,
        "currency"                character varying(3) NOT NULL DEFAULT 'USD',
        "labor_rate"              double precision NOT NULL DEFAULT 0,
        "overhead_rate"           double precision NOT NULL DEFAULT 0,
        "labor_source"            character varying(24),
        "overhead_source"         character varying(24),
        "closed_by"               character varying(200),
        "closed_at"               TIMESTAMP,
        "notes"                   character varying(500),
        "created_at"              TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"              TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"              TIMESTAMP,
        "created_by"              character varying(255),
        CONSTRAINT "PK_fin_wo_cost_snapshot" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_fin_wo_cost_scope_period" ON "fin_wo_cost_snapshot" ("tenant_id", "plant_id", "period")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_fin_wo_cost_program" ON "fin_wo_cost_snapshot" ("program_id", "period")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fin_wo_cost_period" ON "fin_wo_cost_snapshot" ("period")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fin_wo_cost_wo" ON "fin_wo_cost_snapshot" ("wo_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('fin_wo_cost_snapshot')) {
      await queryRunner.query(`DROP TABLE "fin_wo_cost_snapshot"`);
    }
  }
}
