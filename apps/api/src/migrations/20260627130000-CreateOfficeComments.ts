import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Persistent comments for AXOS Office (Docs, Sheets, Slides).
 *
 * Tenant-safe and additive: creates a generic anchor model that supports slide,
 * object, range/cell and text comments without altering existing documents.
 */
export class CreateOfficeComments20260627130000 implements MigrationInterface {
  name = 'CreateOfficeComments20260627130000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('office_comments')) return;
    await queryRunner.query(`
      CREATE TABLE "office_comments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "documentId" uuid NOT NULL,
        "parentId" uuid,
        "tenant_id" character varying(64),
        "authorEmail" character varying(120),
        "assignedTo" character varying(120),
        "anchorType" character varying(24) NOT NULL DEFAULT 'document',
        "slideIndex" integer,
        "objectId" character varying(160),
        "rangeRef" character varying(160),
        "anchorLabel" character varying(200),
        "text" text NOT NULL,
        "resolved" boolean NOT NULL DEFAULT false,
        "resolvedBy" character varying(120),
        "resolvedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_office_comments" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_office_comments_doc_anchor" ON "office_comments" ("documentId", "anchorType", "slideIndex")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_office_comments_tenant_doc" ON "office_comments" ("tenant_id", "documentId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_office_comments_parent" ON "office_comments" ("parentId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('office_comments'))) return;
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_office_comments_parent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_office_comments_tenant_doc"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_office_comments_doc_anchor"`);
    await queryRunner.query(`DROP TABLE "office_comments"`);
  }
}
