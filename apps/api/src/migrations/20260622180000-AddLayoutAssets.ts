import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Equipment / assets on the 2D layout editor (Industrial Engineering, Fase 5).
 *
 * Additive & idempotent: a new nullable `assets` JSONB column on
 * `sf_line_layouts` holding non-station objects placed on the plan
 * ([{ id, kind, x, y, w, h, rotation, label }]). NULL/empty = none; nothing
 * else is affected.
 */
export class AddLayoutAssets20260622180000 implements MigrationInterface {
  name = 'AddLayoutAssets20260622180000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('sf_line_layouts'))) return;
    if (!(await queryRunner.hasColumn('sf_line_layouts', 'assets'))) {
      await queryRunner.query(
        `ALTER TABLE "sf_line_layouts" ADD COLUMN "assets" jsonb`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('sf_line_layouts'))) return;
    if (await queryRunner.hasColumn('sf_line_layouts', 'assets')) {
      await queryRunner.query(
        `ALTER TABLE "sf_line_layouts" DROP COLUMN "assets"`,
      );
    }
  }
}
