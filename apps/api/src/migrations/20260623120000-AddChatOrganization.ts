import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Organización personal del chat:
 *  - columnas por-usuario en `conversation_members`: fijar / archivar / silenciar
 *    / marcar no leído.
 *  - tabla `saved_messages`: mensajes guardados (destacados) por usuario.
 * Idempotente (se salta lo que ya exista).
 */
export class AddChatOrganization20260623120000 implements MigrationInterface {
  name = 'AddChatOrganization20260623120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const cols: { name: string; ddl: string }[] = [
      { name: 'pinned_at', ddl: '"pinned_at" TIMESTAMP WITH TIME ZONE' },
      { name: 'archived_at', ddl: '"archived_at" TIMESTAMP WITH TIME ZONE' },
      { name: 'muted_until', ddl: '"muted_until" TIMESTAMP WITH TIME ZONE' },
      {
        name: 'marked_unread',
        ddl: '"marked_unread" boolean NOT NULL DEFAULT false',
      },
    ];
    for (const c of cols) {
      if (!(await queryRunner.hasColumn('conversation_members', c.name))) {
        await queryRunner.query(
          `ALTER TABLE "conversation_members" ADD COLUMN ${c.ddl}`,
        );
      }
    }

    if (!(await queryRunner.hasTable('saved_messages'))) {
      await queryRunner.query(`
        CREATE TABLE "saved_messages" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "user_id" uuid NOT NULL,
          "message_id" uuid NOT NULL,
          "conversation_id" uuid NOT NULL,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_saved_messages" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_saved_messages_user_message" UNIQUE ("user_id", "message_id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "IDX_saved_messages_user" ON "saved_messages" ("user_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_saved_messages_message" ON "saved_messages" ("message_id")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "saved_messages"`);
    for (const c of ['pinned_at', 'archived_at', 'muted_until', 'marked_unread']) {
      await queryRunner.query(
        `ALTER TABLE "conversation_members" DROP COLUMN IF EXISTS "${c}"`,
      );
    }
  }
}
