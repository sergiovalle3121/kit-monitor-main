import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Manufacturing cells / zones on the 2D layout editor (Industrial Engineering,
 * Fase 27).
 *
 * Additive & idempotent: a new nullable `cells` JSONB column on
 * `sf_line_layouts` holding named groupings of stations
 * ([{ id, name, color, stationIds }]). NULL/empty = no cells.
 */
export class AddLayoutCells20260623100000 implements MigrationInterface {
  name = 'AddLayoutCells20260623100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('sf_line_layouts'))) return;
    if (!(await queryRunner.hasColumn('sf_line_layouts', 'cells'))) {
      await queryRunner.query(
        `ALTER TABLE "sf_line_layouts" ADD COLUMN "cells" jsonb`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('sf_line_layouts'))) return;
    if (await queryRunner.hasColumn('sf_line_layouts', 'cells')) {
      await queryRunner.query(
        `ALTER TABLE "sf_line_layouts" DROP COLUMN "cells"`,
      );
    }
  }
}
