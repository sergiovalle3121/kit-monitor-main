import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Añade `model` y `escalated` a `ai_message` para que, al reabrir una
 * conversación de CIDE, cada respuesta del asistente vuelva a mostrar el modelo
 * que la generó y si hubo auto-escalación (el badge de §119/§120). 100% aditiva
 * (columnas nullable). Idempotente.
 */
export class AddAiMessageModel20260627140000 implements MigrationInterface {
  name = 'AddAiMessageModel20260627140000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('ai_message'))) return;

    if (!(await queryRunner.hasColumn('ai_message', 'model'))) {
      await queryRunner.query(
        `ALTER TABLE "ai_message" ADD COLUMN "model" character varying(64)`,
      );
    }
    if (!(await queryRunner.hasColumn('ai_message', 'escalated'))) {
      await queryRunner.query(
        `ALTER TABLE "ai_message" ADD COLUMN "escalated" boolean`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('ai_message'))) return;

    if (await queryRunner.hasColumn('ai_message', 'escalated')) {
      await queryRunner.query(
        `ALTER TABLE "ai_message" DROP COLUMN "escalated"`,
      );
    }
    if (await queryRunner.hasColumn('ai_message', 'model')) {
      await queryRunner.query(`ALTER TABLE "ai_message" DROP COLUMN "model"`);
    }
  }
}
