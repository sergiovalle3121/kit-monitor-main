import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `assets` and `maintenance_orders` (CMMS / TPM).
 * Fully additive: brand-new tables, every column nullable or defaulted.
 * Idempotent (skips tables that TypeORM `synchronize` already created).
 */
export class CreateMaintenance20260607150000 implements MigrationInterface {
  name = 'CreateMaintenance20260607150000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    if (!(await queryRunner.hasTable('assets'))) {
      await queryRunner.query(`
        CREATE TABLE "assets" (
          "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"       character varying(36),
          "organization_id" character varying(36),
          "plant_id"        character varying(36),
          "code"            character varying(48),
          "name"            character varying(160) NOT NULL,
          "category"        character varying(120),
          "location"        character varying(160),
          "criticality"     character varying(12) NOT NULL DEFAULT 'MEDIUM',
          "status"          character varying(12) NOT NULL DEFAULT 'RUNNING',
          "manufacturer"    character varying(120),
          "model"           character varying(120),
          "serial_number"   character varying(120),
          "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"      TIMESTAMP,
          "created_by"      character varying(255),
          CONSTRAINT "PK_assets" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "idx_asset_scope_status" ON "assets" ("tenant_id", "plant_id", "status")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_assets_code" ON "assets" ("code")`,
      );
    }

    if (!(await queryRunner.hasTable('maintenance_orders'))) {
      await queryRunner.query(`
        CREATE TABLE "maintenance_orders" (
          "id"               uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"        character varying(36),
          "organization_id"  character varying(36),
          "plant_id"         character varying(36),
          "folio"            character varying(32),
          "title"            character varying(200) NOT NULL,
          "description"      text,
          "type"             character varying(12) NOT NULL DEFAULT 'CORRECTIVE',
          "priority"         character varying(8) NOT NULL DEFAULT 'MEDIUM',
          "status"           character varying(16) NOT NULL DEFAULT 'OPEN',
          "asset_id"         character varying(36),
          "asset_name"       character varying(160),
          "assigned_to"      character varying(200),
          "downtime_minutes" integer NOT NULL DEFAULT 0,
          "due_date"         TIMESTAMP,
          "started_at"       TIMESTAMP,
          "completed_at"     TIMESTAMP,
          "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"       TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"       TIMESTAMP,
          "created_by"       character varying(255),
          CONSTRAINT "PK_maintenance_orders" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "idx_mo_scope_status" ON "maintenance_orders" ("tenant_id", "plant_id", "status")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_maintenance_orders_folio" ON "maintenance_orders" ("folio")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_maintenance_orders_asset" ON "maintenance_orders" ("asset_id")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('maintenance_orders')) {
      await queryRunner.query(`DROP TABLE "maintenance_orders"`);
    }
    if (await queryRunner.hasTable('assets')) {
      await queryRunner.query(`DROP TABLE "assets"`);
    }
  }
}
