import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Flow connectors for the 2D layout editor (Industrial Engineering, Fase 4).
 *
 * Additive & idempotent: a new nullable `connectors` JSONB column on
 * `sf_line_layouts` holding the directed material-flow links between stations
 * ([{ from, to, kind }]). NULL/empty = no flow drawn; nothing else is affected.
 */
export class AddLayoutConnectors20260622170000 implements MigrationInterface {
  name = 'AddLayoutConnectors20260622170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('sf_line_layouts'))) return;
    if (!(await queryRunner.hasColumn('sf_line_layouts', 'connectors'))) {
      await queryRunner.query(
        `ALTER TABLE "sf_line_layouts" ADD COLUMN "connectors" jsonb`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('sf_line_layouts'))) return;
    if (await queryRunner.hasColumn('sf_line_layouts', 'connectors')) {
      await queryRunner.query(
        `ALTER TABLE "sf_line_layouts" DROP COLUMN "connectors"`,
      );
    }
  }
}
