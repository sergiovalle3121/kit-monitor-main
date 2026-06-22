import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DXF background for the 2D layout editor (Industrial Engineering, Fase 2).
 *
 * Additive & idempotent: new nullable/defaulted columns on `sf_line_layouts` to
 * store a read-only client/plant floor plan (raw DXF + filename) and how it is
 * placed over the footprint (offset/scale/rotation/visibility/opacity). NULL
 * `dxf_data` = no background; nothing else in the layout flow is affected.
 */
export class AddLayoutDxf20260622160000 implements MigrationInterface {
  name = 'AddLayoutDxf20260622160000';

  private static readonly COLS: Array<[string, string]> = [
    ['dxf_data', 'text'],
    ['dxf_name', 'character varying(255)'],
    ['dxf_offset_x', 'double precision NOT NULL DEFAULT 0'],
    ['dxf_offset_y', 'double precision NOT NULL DEFAULT 0'],
    ['dxf_scale', 'double precision NOT NULL DEFAULT 1'],
    ['dxf_rotation', 'double precision NOT NULL DEFAULT 0'],
    ['dxf_visible', 'boolean NOT NULL DEFAULT true'],
    ['dxf_opacity', 'double precision NOT NULL DEFAULT 0.5'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The table only exists once the Fase 1 migration/synchronize has run.
    if (!(await queryRunner.hasTable('sf_line_layouts'))) return;
    for (const [col, type] of AddLayoutDxf20260622160000.COLS) {
      if (!(await queryRunner.hasColumn('sf_line_layouts', col))) {
        await queryRunner.query(
          `ALTER TABLE "sf_line_layouts" ADD COLUMN "${col}" ${type}`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('sf_line_layouts'))) return;
    for (const [col] of [...AddLayoutDxf20260622160000.COLS].reverse()) {
      if (await queryRunner.hasColumn('sf_line_layouts', col)) {
        await queryRunner.query(
          `ALTER TABLE "sf_line_layouts" DROP COLUMN "${col}"`,
        );
      }
    }
  }
}
