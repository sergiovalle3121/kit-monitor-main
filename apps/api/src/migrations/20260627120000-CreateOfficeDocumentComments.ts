import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOfficeDocumentComments20260627120000 implements MigrationInterface {
  name = 'CreateOfficeDocumentComments20260627120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "office_document_comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" character varying(64), "document_id" uuid NOT NULL, "anchor_id" character varying(80) NOT NULL, "text" text NOT NULL, "author" character varying(120), "mentions" jsonb, "quoted_text" text, "anchor" jsonb, "replies" jsonb, "assigned_to" character varying(120), "resolved" boolean NOT NULL DEFAULT false, "resolved_by" character varying(120), "resolved_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_office_document_comments" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_doc_comments_doc" ON "office_document_comments" ("document_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_doc_comments_anchor" ON "office_document_comments" ("anchor_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_doc_comments_resolved" ON "office_document_comments" ("resolved")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_doc_comments_assigned" ON "office_document_comments" ("assigned_to")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_doc_comments_scope" ON "office_document_comments" ("tenant_id", "document_id", "resolved")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_doc_comments_scope"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_doc_comments_resolved"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_doc_comments_assigned"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_doc_comments_anchor"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_doc_comments_doc"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "office_document_comments"`);
  }
}
