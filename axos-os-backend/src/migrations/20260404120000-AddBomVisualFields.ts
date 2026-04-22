import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBomVisualFields20260404120000 implements MigrationInterface {
  name = 'AddBomVisualFields20260404120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bom_items"
      ADD COLUMN IF NOT EXISTS "imageUrl" text
    `);
    await queryRunner.query(`
      ALTER TABLE "bom_items"
      ADD COLUMN IF NOT EXISTS "specUrl" text
    `);
    await queryRunner.query(`
      ALTER TABLE "bom_items"
      ADD COLUMN IF NOT EXISTS "hasImage" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('bom_items', 'hasImage');
    await queryRunner.dropColumn('bom_items', 'specUrl');
    await queryRunner.dropColumn('bom_items', 'imageUrl');
  }
}
