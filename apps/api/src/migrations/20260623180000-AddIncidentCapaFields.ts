import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Añade `capa_owner` y `capa_due_date` a `safety_incidents` para registrar el
 * RESPONSABLE de la acción correctiva (CAPA) y su FECHA DE COMPROMISO, que el
 * supervisor EHS define al investigar. Alimenta el aviso de CAPA por vencer /
 * vencida. 100% aditiva (columnas nullable). Idempotente.
 */
export class AddIncidentCapaFields20260623180000 implements MigrationInterface {
  name = 'AddIncidentCapaFields20260623180000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('safety_incidents'))) return;

    if (!(await queryRunner.hasColumn('safety_incidents', 'capa_owner'))) {
      await queryRunner.query(
        `ALTER TABLE "safety_incidents" ADD COLUMN "capa_owner" character varying(200)`,
      );
    }
    if (!(await queryRunner.hasColumn('safety_incidents', 'capa_due_date'))) {
      await queryRunner.query(
        `ALTER TABLE "safety_incidents" ADD COLUMN "capa_due_date" TIMESTAMP`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('safety_incidents'))) return;

    if (await queryRunner.hasColumn('safety_incidents', 'capa_due_date')) {
      await queryRunner.query(
        `ALTER TABLE "safety_incidents" DROP COLUMN "capa_due_date"`,
      );
    }
    if (await queryRunner.hasColumn('safety_incidents', 'capa_owner')) {
      await queryRunner.query(
        `ALTER TABLE "safety_incidents" DROP COLUMN "capa_owner"`,
      );
    }
  }
}
