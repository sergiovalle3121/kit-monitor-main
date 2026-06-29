import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOfficeDocumentSignatures20260627180000 implements MigrationInterface {
  name = 'CreateOfficeDocumentSignatures20260627180000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "office_document_signatures" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" character varying(64), "document_id" uuid NOT NULL, "meaning" character varying(32) NOT NULL, "signature_type" character varying(32) NOT NULL DEFAULT 'electronic', "signer_email" character varying(120), "signer_name" character varying(160), "signer_role" character varying(120), "statement" text NOT NULL, "content_hash" character varying(128) NOT NULL, "metadata" jsonb, "revoked" boolean NOT NULL DEFAULT false, "revoked_by" character varying(120), "revoked_at" TIMESTAMP, "signed_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_office_document_signatures" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_doc_signatures_doc" ON "office_document_signatures" ("document_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_doc_signatures_tenant" ON "office_document_signatures" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_doc_signatures_scope" ON "office_document_signatures" ("tenant_id", "document_id", "revoked")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_doc_signatures_scope"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_doc_signatures_tenant"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_doc_signatures_doc"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "office_document_signatures"`);
  }
}
