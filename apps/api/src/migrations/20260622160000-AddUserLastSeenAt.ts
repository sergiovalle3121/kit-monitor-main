import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Añade `last_seen_at` a `users` para mostrar "visto hace…" en el chat.
 * 100% aditiva (columna nullable). Idempotente.
 */
export class AddUserLastSeenAt20260622160000 implements MigrationInterface {
  name = 'AddUserLastSeenAt20260622160000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('users', 'last_seen_at'))) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN "last_seen_at" TIMESTAMP WITH TIME ZONE`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('users', 'last_seen_at')) {
      await queryRunner.query(
        `ALTER TABLE "users" DROP COLUMN "last_seen_at"`,
      );
    }
  }
}
