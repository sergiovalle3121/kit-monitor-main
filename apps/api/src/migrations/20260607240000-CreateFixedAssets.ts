import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `fixed_assets` — capitalized fixed assets + depreciation (FIN).
 * Fully additive: brand-new table, every column nullable or defaulted.
 * Idempotent (skips if TypeORM `synchronize` already created it on Railway).
 */
export class CreateFixedAssets20260607240000 implements MigrationInterface {
  name = 'CreateFixedAssets20260607240000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('fixed_assets')) return;

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "fixed_assets" (
        "id"                 uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"          character varying(36),
        "organization_id"    character varying(36),
        "plant_id"           character varying(36),
        "folio"              character varying(32),
        "name"               character varying(200) NOT NULL,
        "category"           character varying(120),
        "acquisition_cost"   double precision NOT NULL DEFAULT 0,
        "salvage_value"      double precision NOT NULL DEFAULT 0,
        "useful_life_months" integer NOT NULL DEFAULT 0,
        "currency"           character varying(3) NOT NULL DEFAULT 'USD',
        "method"             character varying(16) NOT NULL DEFAULT 'STRAIGHT_LINE',
        "status"             character varying(12) NOT NULL DEFAULT 'IN_SERVICE',
        "location"           character varying(160),
        "program_id"         character varying(64),
        "acquisition_date"   TIMESTAMP,
        "disposed_at"        TIMESTAMP,
        "created_at"         TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"         TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"         TIMESTAMP,
        "created_by"         character varying(255),
        CONSTRAINT "PK_fixed_assets" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_fa_scope_status" ON "fixed_assets" ("tenant_id", "plant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fixed_assets_folio" ON "fixed_assets" ("folio")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fixed_assets_program" ON "fixed_assets" ("program_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('fixed_assets')) {
      await queryRunner.query(`DROP TABLE "fixed_assets"`);
    }
  }
}
