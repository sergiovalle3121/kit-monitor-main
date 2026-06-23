import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tablas para encuestas (`poll_votes`) y mensajes programados
 * (`scheduled_messages`). Idempotente (se salta si ya existen).
 */
export class AddPollsAndScheduled20260622181000 implements MigrationInterface {
  name = 'AddPollsAndScheduled20260622181000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('poll_votes'))) {
      await queryRunner.query(`
        CREATE TABLE "poll_votes" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "message_id" uuid NOT NULL,
          "user_id" uuid NOT NULL,
          "option_id" varchar(40) NOT NULL,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_poll_votes" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_poll_votes_msg_user_opt" UNIQUE ("message_id", "user_id", "option_id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "IDX_poll_votes_message" ON "poll_votes" ("message_id")`,
      );
    }
    if (!(await queryRunner.hasTable('scheduled_messages'))) {
      await queryRunner.query(`
        CREATE TABLE "scheduled_messages" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "conversation_id" uuid NOT NULL,
          "sender_id" uuid NOT NULL,
          "body" text NOT NULL,
          "send_at" TIMESTAMP WITH TIME ZONE NOT NULL,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_scheduled_messages" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "IDX_scheduled_send_at" ON "scheduled_messages" ("send_at")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_scheduled_sender" ON "scheduled_messages" ("sender_id")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "poll_votes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "scheduled_messages"`);
  }
}
