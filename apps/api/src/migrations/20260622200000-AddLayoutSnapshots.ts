import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Layout snapshots / versions on the 2D layout editor (Industrial Engineering,
 * Fase 13).
 *
 * Additive & idempotent: a new nullable `snapshots` JSONB column on
 * `sf_line_layouts` holding named, point-in-time copies of the arrangement
 * ([{ id, name, createdAt, footprint, positions, connectors, assets,
 * annotations, dxf }]). NULL/empty = no saved versions.
 */
export class AddLayoutSnapshots20260622200000 implements MigrationInterface {
  name = 'AddLayoutSnapshots20260622200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('sf_line_layouts'))) return;
    if (!(await queryRunner.hasColumn('sf_line_layouts', 'snapshots'))) {
      await queryRunner.query(
        `ALTER TABLE "sf_line_layouts" ADD COLUMN "snapshots" jsonb`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('sf_line_layouts'))) return;
    if (await queryRunner.hasColumn('sf_line_layouts', 'snapshots')) {
      await queryRunner.query(
        `ALTER TABLE "sf_line_layouts" DROP COLUMN "snapshots"`,
      );
    }
  }
}
