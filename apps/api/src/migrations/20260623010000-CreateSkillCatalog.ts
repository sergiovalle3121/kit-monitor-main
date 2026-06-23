import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Catálogo formal de skills (RH). Additivo: tabla nueva, idempotente con
 * IF NOT EXISTS (en la mayoría de entornos `synchronize: true` ya la creó).
 */
export class CreateSkillCatalog20260623010000 implements MigrationInterface {
  name = 'CreateSkillCatalog20260623010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "skill_catalog" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(160) NOT NULL,
        "category" character varying(120),
        "area" character varying(120),
        "default_validity_months" integer,
        "description" character varying(255),
        "active" boolean NOT NULL DEFAULT true,
        "tenant_id" character varying(36),
        "organization_id" character varying(36),
        "plant_id" character varying(36),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "created_by" character varying(255),
        CONSTRAINT "PK_skill_catalog_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_skill_catalog_scope" ON "skill_catalog" ("tenant_id", "plant_id", "active")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "skill_catalog"');
  }
}
