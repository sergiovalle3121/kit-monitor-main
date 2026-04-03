import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBomItemLocation20260401213000 implements MigrationInterface {
  name = 'AddBomItemLocation20260401213000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bom_items"
      ADD COLUMN "location" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bom_items"
      DROP COLUMN "location"
    `);
  }
}
