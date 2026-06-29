import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOfficeDocumentDistributions20260627170000 implements MigrationInterface {
  name = 'CreateOfficeDocumentDistributions20260627170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "office_document_distributions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" character varying(64), "document_id" uuid NOT NULL, "action" character varying(32) NOT NULL, "format" character varying(24) NOT NULL, "copy_no" integer NOT NULL, "recipient" character varying(160), "purpose" character varying(240), "actor" character varying(120), "metadata" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_office_document_distributions" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_doc_dist_doc" ON "office_document_distributions" ("document_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_doc_dist_tenant" ON "office_document_distributions" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_doc_dist_scope" ON "office_document_distributions" ("tenant_id", "document_id", "created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_doc_dist_scope"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_doc_dist_tenant"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_doc_dist_doc"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "office_document_distributions"`);
  }
}
