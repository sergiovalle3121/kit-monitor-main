import { MigrationInterface, QueryRunner } from 'typeorm';

export class KitPlanSchemaUpdate20260401193000 implements MigrationInterface {
  name = 'KitPlanSchemaUpdate20260401193000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "kits" ADD COLUMN IF NOT EXISTS "kittedAt" TIMESTAMP',
    );
    await queryRunner.query(
      'ALTER TABLE "kits" ADD COLUMN IF NOT EXISTS "requestedAt" TIMESTAMP',
    );
    await queryRunner.query(
      'ALTER TABLE "kits" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP',
    );
    await queryRunner.query(
      'ALTER TABLE "plans" ALTER COLUMN "bahia" DROP NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const result = await queryRunner.query(
      'SELECT COUNT(*)::int AS "count" FROM "plans" WHERE "bahia" IS NULL',
    );
    const nullCount = Number(result?.[0]?.count ?? 0);

    if (nullCount > 0) {
      throw new Error(
        `Cannot restore NOT NULL on plans.bahia: found ${nullCount} row(s) with NULL bahia.`,
      );
    }

    await queryRunner.query(
      'ALTER TABLE "plans" ALTER COLUMN "bahia" SET NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "kits" DROP COLUMN IF EXISTS "deliveredAt"',
    );
    await queryRunner.query(
      'ALTER TABLE "kits" DROP COLUMN IF EXISTS "requestedAt"',
    );
    await queryRunner.query(
      'ALTER TABLE "kits" DROP COLUMN IF EXISTS "kittedAt"',
    );
  }
}
