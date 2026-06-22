import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Annotations on the 2D layout editor (Industrial Engineering, Fase 7).
 *
 * Additive & idempotent: a new nullable `annotations` JSONB column on
 * `sf_line_layouts` holding free-text labels and dimension lines
 * ([{ id, type, x, y, x2, y2, text, color }]). NULL/empty = none.
 */
export class AddLayoutAnnotations20260622190000 implements MigrationInterface {
  name = 'AddLayoutAnnotations20260622190000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('sf_line_layouts'))) return;
    if (!(await queryRunner.hasColumn('sf_line_layouts', 'annotations'))) {
      await queryRunner.query(
        `ALTER TABLE "sf_line_layouts" ADD COLUMN "annotations" jsonb`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('sf_line_layouts'))) return;
    if (await queryRunner.hasColumn('sf_line_layouts', 'annotations')) {
      await queryRunner.query(
        `ALTER TABLE "sf_line_layouts" DROP COLUMN "annotations"`,
      );
    }
  }
}
