import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tabla `conversation_labels`: etiquetas/carpetas personales (por usuario) para
 * organizar conversaciones. Idempotente (se salta si ya existe).
 */
export class AddConversationLabels20260622200000 implements MigrationInterface {
  name = 'AddConversationLabels20260622200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('conversation_labels'))) {
      await queryRunner.query(`
        CREATE TABLE "conversation_labels" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "user_id" uuid NOT NULL,
          "conversation_id" uuid NOT NULL,
          "label" varchar(40) NOT NULL,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_conversation_labels" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_conversation_labels_user_convo_label" UNIQUE ("user_id", "conversation_id", "label")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "IDX_conversation_labels_user" ON "conversation_labels" ("user_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_conversation_labels_convo" ON "conversation_labels" ("conversation_id")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "conversation_labels"`);
  }
}
