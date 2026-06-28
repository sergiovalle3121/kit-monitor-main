import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Añade `knowledge` a `ai_tenant_config`: texto libre con el conocimiento de la
 * empresa (FAQs, políticas, definiciones) que un admin le "enseña" a CIDE y que
 * se inyecta en su prompt. 100% aditiva (columna nullable). Idempotente.
 */
export class AddAiKnowledge20260628010000 implements MigrationInterface {
  name = 'AddAiKnowledge20260628010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('ai_tenant_config'))) return;
    if (!(await queryRunner.hasColumn('ai_tenant_config', 'knowledge'))) {
      await queryRunner.query(
        `ALTER TABLE "ai_tenant_config" ADD COLUMN "knowledge" text`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('ai_tenant_config'))) return;
    if (await queryRunner.hasColumn('ai_tenant_config', 'knowledge')) {
      await queryRunner.query(
        `ALTER TABLE "ai_tenant_config" DROP COLUMN "knowledge"`,
      );
    }
  }
}
