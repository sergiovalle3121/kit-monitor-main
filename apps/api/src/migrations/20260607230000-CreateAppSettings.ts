import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Singleton key/value settings table. Backs the persistent JWT secret (so a
 * redeploy without a JWT_SECRET env no longer logs everyone out) and any future
 * runtime config. Fully additive + idempotent. NOTE: the runtime path also
 * creates this table defensively (CREATE TABLE IF NOT EXISTS) in the bootstrap
 * helper, because the secret is resolved before TypeORM synchronize runs.
 */
export class CreateAppSettings20260607230000 implements MigrationInterface {
  name = 'CreateAppSettings20260607230000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('app_settings')) return;
    await queryRunner.query(`
      CREATE TABLE "app_settings" (
        "key"        character varying(120) NOT NULL,
        "value"      text NOT NULL,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_app_settings" PRIMARY KEY ("key")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('app_settings')) {
      await queryRunner.query(`DROP TABLE "app_settings"`);
    }
  }
}
