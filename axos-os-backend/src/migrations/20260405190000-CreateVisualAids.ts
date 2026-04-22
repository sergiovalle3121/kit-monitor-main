import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVisualAids20260405190000 implements MigrationInterface {
  name = 'CreateVisualAids20260405190000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "visual_aids" (
        "id" character varying(64) NOT NULL,
        "model" character varying(120) NOT NULL,
        "title" character varying(180) NOT NULL,
        "process" character varying(120) NOT NULL,
        "area" character varying(120),
        "revision" character varying(80),
        "filename" text NOT NULL,
        "notes" text,
        "active" boolean NOT NULL DEFAULT true,
        "uploadedBy" character varying(80),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_visual_aids_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "visual_aids"
      ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP NOT NULL DEFAULT now()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "visual_aids"');
  }
}
