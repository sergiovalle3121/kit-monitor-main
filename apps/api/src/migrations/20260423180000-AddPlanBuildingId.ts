import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlanBuildingId20260423180000 implements MigrationInterface {
  name = 'AddPlanBuildingId20260423180000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // We use a safe check because synchronize might have created it in some environments
    const hasColumn = await queryRunner.hasColumn('plans', 'buildingId');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "plans" ADD "buildingId" character varying(32)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('plans', 'buildingId');
    if (hasColumn) {
      await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "buildingId"`);
    }
  }
}
