import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOfficeDocumentReviewTasks20260627200000 implements MigrationInterface {
  name = 'CreateOfficeDocumentReviewTasks20260627200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "office_document_review_tasks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" character varying(64), "document_id" uuid NOT NULL, "reviewer_email" character varying(120) NOT NULL, "assigned_by" character varying(120), "status" character varying(32) NOT NULL DEFAULT 'pending', "due_at" TIMESTAMP, "decided_at" TIMESTAMP, "note" text, "decision_note" text, "signature_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_office_document_review_tasks" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_doc_review_doc" ON "office_document_review_tasks" ("document_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_doc_review_reviewer" ON "office_document_review_tasks" ("reviewer_email")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_doc_review_status" ON "office_document_review_tasks" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_doc_review_scope" ON "office_document_review_tasks" ("tenant_id", "document_id", "status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_doc_review_scope"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_doc_review_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_doc_review_reviewer"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_doc_review_doc"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "office_document_review_tasks"`);
  }
}
