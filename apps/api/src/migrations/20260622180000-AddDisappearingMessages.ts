import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Mensajes temporales: `messages.expires_at` y `conversations.disappearing_seconds`.
 * 100% aditiva. Idempotente.
 */
export class AddDisappearingMessages20260622180000 implements MigrationInterface {
  name = 'AddDisappearingMessages20260622180000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('messages', 'expires_at'))) {
      await queryRunner.query(
        `ALTER TABLE "messages" ADD COLUMN "expires_at" TIMESTAMP WITH TIME ZONE`,
      );
    }
    if (!(await queryRunner.hasColumn('conversations', 'disappearing_seconds'))) {
      await queryRunner.query(
        `ALTER TABLE "conversations" ADD COLUMN "disappearing_seconds" integer NOT NULL DEFAULT 0`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('messages', 'expires_at')) {
      await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "expires_at"`);
    }
    if (await queryRunner.hasColumn('conversations', 'disappearing_seconds')) {
      await queryRunner.query(
        `ALTER TABLE "conversations" DROP COLUMN "disappearing_seconds"`,
      );
    }
  }
}
