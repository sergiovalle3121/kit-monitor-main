import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Acciones de mensaje: responder (reply_to_id), editar (edited_at), eliminar
 * (deleted_at), fijar (pinned_at) y reenviar (forwarded).
 *
 * 100% aditiva: columnas nuevas nullable / con default. Idempotente (se salta si
 * TypeORM `synchronize` ya las creó).
 */
export class AddMessageThreadActions20260622140000 implements MigrationInterface {
  name = 'AddMessageThreadActions20260622140000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('messages', 'reply_to_id'))) {
      await queryRunner.query(
        `ALTER TABLE "messages" ADD COLUMN "reply_to_id" uuid`,
      );
    }
    if (!(await queryRunner.hasColumn('messages', 'edited_at'))) {
      await queryRunner.query(
        `ALTER TABLE "messages" ADD COLUMN "edited_at" TIMESTAMP WITH TIME ZONE`,
      );
    }
    if (!(await queryRunner.hasColumn('messages', 'deleted_at'))) {
      await queryRunner.query(
        `ALTER TABLE "messages" ADD COLUMN "deleted_at" TIMESTAMP WITH TIME ZONE`,
      );
    }
    if (!(await queryRunner.hasColumn('messages', 'pinned_at'))) {
      await queryRunner.query(
        `ALTER TABLE "messages" ADD COLUMN "pinned_at" TIMESTAMP WITH TIME ZONE`,
      );
    }
    if (!(await queryRunner.hasColumn('messages', 'forwarded'))) {
      await queryRunner.query(
        `ALTER TABLE "messages" ADD COLUMN "forwarded" boolean NOT NULL DEFAULT false`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const col of [
      'forwarded',
      'pinned_at',
      'deleted_at',
      'edited_at',
      'reply_to_id',
    ]) {
      if (await queryRunner.hasColumn('messages', col)) {
        await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "${col}"`);
      }
    }
  }
}
