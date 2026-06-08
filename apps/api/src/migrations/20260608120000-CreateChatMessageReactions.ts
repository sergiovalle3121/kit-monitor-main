import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea `chat_message_reactions` — reacciones (emoji) a mensajes del chat.
 * 100% aditiva: tabla nueva PREFIJADA, no toca tablas existentes.
 * Idempotente (se salta si TypeORM `synchronize` ya la creó en Railway).
 */
export class CreateChatMessageReactions20260608120000 implements MigrationInterface {
  name = 'CreateChatMessageReactions20260608120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('chat_message_reactions')) return;

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "chat_message_reactions" (
        "id"         uuid NOT NULL DEFAULT uuid_generate_v4(),
        "message_id" uuid NOT NULL,
        "user_id"    uuid NOT NULL,
        "emoji"      character varying(32) NOT NULL,
        "tenant_id"  character varying(100),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_message_reactions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_chat_message_reactions_msg_user_emoji"
          UNIQUE ("message_id", "user_id", "emoji")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_chat_message_reactions_message" ON "chat_message_reactions" ("message_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_chat_message_reactions_tenant" ON "chat_message_reactions" ("tenant_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('chat_message_reactions')) {
      await queryRunner.query(`DROP TABLE "chat_message_reactions"`);
    }
  }
}
