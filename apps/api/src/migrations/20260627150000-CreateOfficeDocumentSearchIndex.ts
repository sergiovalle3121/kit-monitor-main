import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOfficeDocumentSearchIndex20260627150000 implements MigrationInterface {
  name = 'CreateOfficeDocumentSearchIndex20260627150000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "office_document_search_index" ("document_id" uuid NOT NULL, "tenant_id" character varying(64), "text" text NOT NULL DEFAULT '', "refs" jsonb, "refs_text" text NOT NULL DEFAULT '', "fields" jsonb, "fields_text" text NOT NULL DEFAULT '', "word_count" integer NOT NULL DEFAULT 0, "ref_count" integer NOT NULL DEFAULT 0, "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_office_document_search_index" PRIMARY KEY ("document_id"))`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_doc_search_tenant" ON "office_document_search_index" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_doc_search_doc_tenant" ON "office_document_search_index" ("document_id", "tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_doc_search_refs_text" ON "office_document_search_index" ("refs_text")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_doc_search_refs_text"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_doc_search_doc_tenant"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_doc_search_tenant"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "office_document_search_index"`);
  }
}
