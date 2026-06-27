import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Añade `auto_escalate` a `ai_tenant_config` para que un admin pueda activar/
 * desactivar la auto-escalación de modelo de CIDE por organización (null =
 * heredar el default de proceso `CIDE_AUTO_ESCALATE`). 100% aditiva (columna
 * nullable). Idempotente.
 */
export class AddAiAutoEscalate20260627150000 implements MigrationInterface {
  name = 'AddAiAutoEscalate20260627150000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('ai_tenant_config'))) return;
    if (!(await queryRunner.hasColumn('ai_tenant_config', 'auto_escalate'))) {
      await queryRunner.query(
        `ALTER TABLE "ai_tenant_config" ADD COLUMN "auto_escalate" boolean`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('ai_tenant_config'))) return;
    if (await queryRunner.hasColumn('ai_tenant_config', 'auto_escalate')) {
      await queryRunner.query(
        `ALTER TABLE "ai_tenant_config" DROP COLUMN "auto_escalate"`,
      );
    }
  }
}
