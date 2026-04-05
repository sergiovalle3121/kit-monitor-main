import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVisualAidPdfData20260405220000 implements MigrationInterface {
  name = 'AddVisualAidPdfData20260405220000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "visual_aids"
      ADD COLUMN IF NOT EXISTS "pdf_data" bytea
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "visual_aids"
      DROP COLUMN IF EXISTS "pdf_data"
    `);
  }
}
