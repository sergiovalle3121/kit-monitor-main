import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `document_sequences` — the central folio counter table backing the
 * DocumentNumberingService. Fully additive: a brand-new table, all columns with
 * defaults or nullable. Idempotent (skips if the table already exists, e.g. when
 * TypeORM `synchronize` materialized it first on Railway).
 */
export class CreateDocumentSequences20260607120000
  implements MigrationInterface
{
  name = 'CreateDocumentSequences20260607120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('document_sequences')) return;

    // uuid_generate_v4() lives in the uuid-ossp extension (same as the rest of
    // the schema). gen_random_uuid() would also work on PG13+, but we mirror
    // TypeORM's own default to stay consistent.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "document_sequences" (
        "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"       character varying(36),
        "organization_id" character varying(36),
        "plant_id"        character varying(36),
        "doc_type"        character varying(64) NOT NULL,
        "name"            character varying(120) NOT NULL DEFAULT '',
        "prefix"          character varying(16) NOT NULL DEFAULT '',
        "pattern"         character varying(64) NOT NULL DEFAULT '{PREFIX}-{YYYY}-{SEQ}',
        "padding"         integer NOT NULL DEFAULT 6,
        "next_value"      integer NOT NULL DEFAULT 1,
        "total_issued"    integer NOT NULL DEFAULT 0,
        "reset_policy"    character varying(16) NOT NULL DEFAULT 'NEVER',
        "period_key"      character varying(16),
        "active"          boolean NOT NULL DEFAULT true,
        "description"     character varying(255),
        "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"      TIMESTAMP,
        "created_by"      character varying(255),
        CONSTRAINT "PK_document_sequences" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_docseq_scope_type" ON "document_sequences" ("tenant_id", "plant_id", "doc_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_document_sequences_doc_type" ON "document_sequences" ("doc_type")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('document_sequences')) {
      await queryRunner.query(`DROP TABLE "document_sequences"`);
    }
  }
}
