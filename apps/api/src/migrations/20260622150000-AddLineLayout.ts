import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 2D line/cell layout editor (Industrial Engineering, Fase 1).
 *
 * Two additive changes, both idempotent (skip if TypeORM `synchronize` already
 * applied them on Railway):
 *  1. New nullable physical-placement columns on `sf_line_stations`
 *     (layout_x/y/w/h/rotation) — NULL = station not yet placed. The routing /
 *     balance flow never reads them, so existing data is untouched.
 *  2. New `sf_line_layouts` table — per model+revision canvas config (footprint
 *     size, unit, grid). Net-new, prefixed `sf_`, every column defaulted.
 *
 * Independent from the logical `bay_layouts` (NP→bahía) table — not modified.
 */
export class AddLineLayout20260622150000 implements MigrationInterface {
  name = 'AddLineLayout20260622150000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Station placement columns (additive, nullable).
    const cols: Array<[string, string]> = [
      ['layout_x', 'double precision'],
      ['layout_y', 'double precision'],
      ['layout_w', 'double precision'],
      ['layout_h', 'double precision'],
      ['layout_rotation', 'double precision'],
    ];
    for (const [col, type] of cols) {
      if (!(await queryRunner.hasColumn('sf_line_stations', col))) {
        await queryRunner.query(
          `ALTER TABLE "sf_line_stations" ADD COLUMN "${col}" ${type}`,
        );
      }
    }

    // 2) Layout canvas config table (additive, brand-new).
    if (!(await queryRunner.hasTable('sf_line_layouts'))) {
      await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
      await queryRunner.query(`
        CREATE TABLE "sf_line_layouts" (
          "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"       character varying(36),
          "organization_id" character varying(36),
          "plant_id"        character varying(36),
          "model"           character varying(64) NOT NULL,
          "revision"        character varying(16) NOT NULL DEFAULT 'A',
          "footprint_w"     double precision NOT NULL DEFAULT 20000,
          "footprint_h"     double precision NOT NULL DEFAULT 10000,
          "unit"            character varying(8) NOT NULL DEFAULT 'mm',
          "grid_size"       double precision NOT NULL DEFAULT 500,
          "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"      TIMESTAMP,
          "created_by"      character varying(255),
          CONSTRAINT "PK_sf_line_layouts" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "idx_sf_layout_scope" ON "sf_line_layouts" ("tenant_id", "plant_id", "model", "revision")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_sf_line_layouts_model" ON "sf_line_layouts" ("model")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('sf_line_layouts')) {
      await queryRunner.query(`DROP TABLE "sf_line_layouts"`);
    }
    for (const col of [
      'layout_rotation',
      'layout_h',
      'layout_w',
      'layout_y',
      'layout_x',
    ]) {
      if (await queryRunner.hasColumn('sf_line_stations', col)) {
        await queryRunner.query(
          `ALTER TABLE "sf_line_stations" DROP COLUMN "${col}"`,
        );
      }
    }
  }
}
