import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKitMaterialBulkResupply20260402052000 implements MigrationInterface {
  name = 'AddKitMaterialBulkResupply20260402052000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "kit_materials"
      ADD COLUMN IF NOT EXISTS "isBulkResupply" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "kit_materials"
      DROP COLUMN "isBulkResupply"
    `);
  }
}
