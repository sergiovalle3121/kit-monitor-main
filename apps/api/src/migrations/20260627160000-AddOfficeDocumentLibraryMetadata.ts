import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOfficeDocumentLibraryMetadata20260627160000 implements MigrationInterface {
  name = 'AddOfficeDocumentLibraryMetadata20260627160000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "office_documents" ADD COLUMN IF NOT EXISTS "space" character varying(80)`);
    await queryRunner.query(`ALTER TABLE "office_documents" ADD COLUMN IF NOT EXISTS "folder_path" character varying(240)`);
    await queryRunner.query(`ALTER TABLE "office_documents" ADD COLUMN IF NOT EXISTS "collection" character varying(120)`);
    await queryRunner.query(`ALTER TABLE "office_documents" ADD COLUMN IF NOT EXISTS "tags" jsonb`);
    await queryRunner.query(`ALTER TABLE "office_documents" ADD COLUMN IF NOT EXISTS "favorite" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "office_documents" ADD COLUMN IF NOT EXISTS "pinned" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_docs_space" ON "office_documents" ("space")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_docs_folder" ON "office_documents" ("folder_path")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_office_docs_library_flags" ON "office_documents" ("favorite", "pinned")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_docs_library_flags"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_docs_folder"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_office_docs_space"`);
    await queryRunner.query(`ALTER TABLE "office_documents" DROP COLUMN IF EXISTS "pinned"`);
    await queryRunner.query(`ALTER TABLE "office_documents" DROP COLUMN IF EXISTS "favorite"`);
    await queryRunner.query(`ALTER TABLE "office_documents" DROP COLUMN IF EXISTS "tags"`);
    await queryRunner.query(`ALTER TABLE "office_documents" DROP COLUMN IF EXISTS "collection"`);
    await queryRunner.query(`ALTER TABLE "office_documents" DROP COLUMN IF EXISTS "folder_path"`);
    await queryRunner.query(`ALTER TABLE "office_documents" DROP COLUMN IF EXISTS "space"`);
  }
}
