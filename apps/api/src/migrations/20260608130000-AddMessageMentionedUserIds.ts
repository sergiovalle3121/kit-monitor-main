import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Añade `mentioned_user_ids` a `messages` para @menciones.
 * 100% aditiva: columna nueva nullable, no toca columnas existentes.
 * Idempotente (se salta si TypeORM `synchronize` ya la creó en Railway).
 * `simple-array` de TypeORM se almacena como `text` (CSV).
 */
export class AddMessageMentionedUserIds20260608130000 implements MigrationInterface {
  name = 'AddMessageMentionedUserIds20260608130000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn(
      'messages',
      'mentioned_user_ids',
    );
    if (hasColumn) return;
    await queryRunner.query(
      `ALTER TABLE "messages" ADD COLUMN "mentioned_user_ids" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn(
      'messages',
      'mentioned_user_ids',
    );
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "messages" DROP COLUMN "mentioned_user_ids"`,
      );
    }
  }
}
