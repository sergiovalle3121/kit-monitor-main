import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOfficeDocumentTrainingAssignments20260627190000 implements MigrationInterface {
  name = 'CreateOfficeDocumentTrainingAssignments20260627190000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "office_document_training_assignments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" character varying(64), "document_id" uuid NOT NULL, "assignee_email" character varying(120) NOT NULL, "assigned_by" character varying(120), "status" character varying(32) NOT NULL DEFAULT 'pending', "due_at" TIMESTAMP, "acknowledged_at" TIMESTAMP, "signature_id" uuid, "note" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_office_document_training_assignments" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_doc_training_doc" ON "office_document_training_assignments" ("document_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_doc_training_assignee" ON "office_document_training_assignments" ("assignee_email")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_doc_training_status" ON "office_document_training_assignments" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_doc_training_scope" ON "office_document_training_assignments" ("tenant_id", "document_id", "status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_doc_training_scope"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_doc_training_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_doc_training_assignee"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_doc_training_doc"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "office_document_training_assignments"`);
  }
}
