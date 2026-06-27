import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Soft-link an NPI project to its canonical ProductModel.
 *
 * Additive and non-destructive: adds a nullable `product_model_id` (plain
 * varchar, NO foreign-key constraint — keeps `npi_project` decoupled from
 * `pm_product_models`). The service resolves it best-effort at create and
 * backfills it lazily on read, so existing rows keep working untouched.
 * Guarded because `synchronize: true` may already have created the column.
 */
export class AddNpiProductModelId20260627000000 implements MigrationInterface {
  name = 'AddNpiProductModelId20260627000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('npi_project'))) return;
    const hasColumn = await queryRunner.hasColumn(
      'npi_project',
      'product_model_id',
    );
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "npi_project" ADD "product_model_id" character varying(36)`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_npi_project_product_model" ON "npi_project" ("product_model_id")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('npi_project'))) return;
    const hasColumn = await queryRunner.hasColumn(
      'npi_project',
      'product_model_id',
    );
    if (hasColumn) {
      await queryRunner.query(
        `DROP INDEX IF EXISTS "IDX_npi_project_product_model"`,
      );
      await queryRunner.query(
        `ALTER TABLE "npi_project" DROP COLUMN "product_model_id"`,
      );
    }
  }
}
