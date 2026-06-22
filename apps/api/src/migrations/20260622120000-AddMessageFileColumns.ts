import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Añade soporte de ARCHIVOS genéricos (PDF/Word/Excel/zip…) a `messages`:
 * `file_data` (binario), `file_name`, `file_mime`, `file_size`.
 *
 * 100% aditiva: columnas nuevas nullable, no toca columnas existentes.
 * Idempotente (se salta si TypeORM `synchronize` ya las creó en Railway).
 */
export class AddMessageFileColumns20260622120000 implements MigrationInterface {
  name = 'AddMessageFileColumns20260622120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('messages', 'file_data'))) {
      await queryRunner.query(
        `ALTER TABLE "messages" ADD COLUMN "file_data" bytea`,
      );
    }
    if (!(await queryRunner.hasColumn('messages', 'file_name'))) {
      await queryRunner.query(
        `ALTER TABLE "messages" ADD COLUMN "file_name" varchar(255)`,
      );
    }
    if (!(await queryRunner.hasColumn('messages', 'file_mime'))) {
      await queryRunner.query(
        `ALTER TABLE "messages" ADD COLUMN "file_mime" varchar(150)`,
      );
    }
    if (!(await queryRunner.hasColumn('messages', 'file_size'))) {
      await queryRunner.query(
        `ALTER TABLE "messages" ADD COLUMN "file_size" integer`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const col of ['file_size', 'file_mime', 'file_name', 'file_data']) {
      if (await queryRunner.hasColumn('messages', col)) {
        await queryRunner.query(
          `ALTER TABLE "messages" DROP COLUMN "${col}"`,
        );
      }
    }
  }
}
