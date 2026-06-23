import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Approval / sign-off lifecycle on the 2D layout (Industrial Engineering,
 * Fase 29).
 *
 * Additive & idempotent: four new nullable columns on `sf_line_layouts` to track
 * the release state — `approval_status` (draft|in_review|approved),
 * `approved_by`, `approved_at`, `approval_note`. NULL status = draft.
 */
export class AddLayoutApproval20260623110000 implements MigrationInterface {
  name = 'AddLayoutApproval20260623110000';

  private readonly cols: { name: string; ddl: string }[] = [
    { name: 'approval_status', ddl: '"approval_status" varchar(16)' },
    { name: 'approved_by', ddl: '"approved_by" varchar(160)' },
    { name: 'approved_at', ddl: '"approved_at" TIMESTAMP' },
    { name: 'approval_note', ddl: '"approval_note" varchar(240)' },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('sf_line_layouts'))) return;
    for (const c of this.cols) {
      if (!(await queryRunner.hasColumn('sf_line_layouts', c.name))) {
        await queryRunner.query(
          `ALTER TABLE "sf_line_layouts" ADD COLUMN ${c.ddl}`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('sf_line_layouts'))) return;
    for (const c of this.cols) {
      if (await queryRunner.hasColumn('sf_line_layouts', c.name)) {
        await queryRunner.query(
          `ALTER TABLE "sf_line_layouts" DROP COLUMN "${c.name}"`,
        );
      }
    }
  }
}
