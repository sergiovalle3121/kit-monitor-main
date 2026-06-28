import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOfficeDocumentLifecycle20260627130000 implements MigrationInterface {
  name = 'AddOfficeDocumentLifecycle20260627130000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "office_documents" ADD "lifecycle_state" character varying(24) NOT NULL DEFAULT 'draft'`);
    await queryRunner.query(`ALTER TABLE "office_documents" ADD "locked" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "office_documents" ADD "approved_by" character varying(120)`);
    await queryRunner.query(`ALTER TABLE "office_documents" ADD "approved_at" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "office_documents" ADD "released_by" character varying(120)`);
    await queryRunner.query(`ALTER TABLE "office_documents" ADD "released_at" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "office_documents" ADD "obsoleted_by" character varying(120)`);
    await queryRunner.query(`ALTER TABLE "office_documents" ADD "obsoleted_at" TIMESTAMP`);
    await queryRunner.query(`CREATE INDEX "IDX_office_documents_lifecycle_state" ON "office_documents" ("lifecycle_state")`);
    await queryRunner.query(`CREATE INDEX "IDX_office_documents_tenant_lifecycle" ON "office_documents" ("tenantId", "lifecycle_state")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_office_documents_tenant_lifecycle"`);
    await queryRunner.query(`DROP INDEX "IDX_office_documents_lifecycle_state"`);
    await queryRunner.query(`ALTER TABLE "office_documents" DROP COLUMN "obsoleted_at"`);
    await queryRunner.query(`ALTER TABLE "office_documents" DROP COLUMN "obsoleted_by"`);
    await queryRunner.query(`ALTER TABLE "office_documents" DROP COLUMN "released_at"`);
    await queryRunner.query(`ALTER TABLE "office_documents" DROP COLUMN "released_by"`);
    await queryRunner.query(`ALTER TABLE "office_documents" DROP COLUMN "approved_at"`);
    await queryRunner.query(`ALTER TABLE "office_documents" DROP COLUMN "approved_by"`);
    await queryRunner.query(`ALTER TABLE "office_documents" DROP COLUMN "locked"`);
    await queryRunner.query(`ALTER TABLE "office_documents" DROP COLUMN "lifecycle_state"`);
  }
}
