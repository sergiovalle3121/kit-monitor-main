import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOfficeDocumentPeriodicReview20260627210000 implements MigrationInterface {
  name = 'AddOfficeDocumentPeriodicReview20260627210000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "office_documents" ADD COLUMN IF NOT EXISTS "next_review_at" timestamp`);
    await queryRunner.query(`ALTER TABLE "office_documents" ADD COLUMN IF NOT EXISTS "review_interval_days" integer`);
    await queryRunner.query(`ALTER TABLE "office_documents" ADD COLUMN IF NOT EXISTS "review_owner" character varying(120)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_docs_next_review" ON "office_documents" ("next_review_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_docs_review_owner" ON "office_documents" ("review_owner")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_docs_review_owner"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_docs_next_review"`);
    await queryRunner.query(`ALTER TABLE "office_documents" DROP COLUMN IF EXISTS "review_owner"`);
    await queryRunner.query(`ALTER TABLE "office_documents" DROP COLUMN IF EXISTS "review_interval_days"`);
    await queryRunner.query(`ALTER TABLE "office_documents" DROP COLUMN IF EXISTS "next_review_at"`);
  }
}
