import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Explicit, audited release-to-MP fields on a launch.
 *
 * Additive and non-destructive: three nullable columns on `npi_project`
 * (`released_at`, `released_by`, `release_note`). Existing rows keep working.
 * Guarded because `synchronize: true` may already have created the columns.
 */
export class AddNpiRelease20260627020000 implements MigrationInterface {
  name = 'AddNpiRelease20260627020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('npi_project'))) return;

    if (!(await queryRunner.hasColumn('npi_project', 'released_at'))) {
      await queryRunner.query(
        `ALTER TABLE "npi_project" ADD "released_at" TIMESTAMP`,
      );
    }
    if (!(await queryRunner.hasColumn('npi_project', 'released_by'))) {
      await queryRunner.query(
        `ALTER TABLE "npi_project" ADD "released_by" character varying(200)`,
      );
    }
    if (!(await queryRunner.hasColumn('npi_project', 'release_note'))) {
      await queryRunner.query(
        `ALTER TABLE "npi_project" ADD "release_note" character varying(500)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('npi_project'))) return;
    for (const col of ['release_note', 'released_by', 'released_at']) {
      if (await queryRunner.hasColumn('npi_project', col)) {
        await queryRunner.query(
          `ALTER TABLE "npi_project" DROP COLUMN "${col}"`,
        );
      }
    }
  }
}
