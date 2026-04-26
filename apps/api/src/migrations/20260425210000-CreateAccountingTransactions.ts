import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAccountingTransactions20260425210000
  implements MigrationInterface
{
  name = 'CreateAccountingTransactions20260425210000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" character varying(36),
        "organization_id" character varying(36),
        "plant_id" character varying(36),
        "journalId" character varying(64) NOT NULL,
        "lineNumber" integer NOT NULL,
        "direction" character varying(16) NOT NULL,
        "accountCode" character varying(24) NOT NULL,
        "accountName" character varying(120) NOT NULL,
        "sourceType" character varying(40) NOT NULL,
        "sourceId" character varying(120) NOT NULL,
        "referenceType" character varying(80),
        "referenceId" character varying(120),
        "materialPartNumber" character varying(100),
        "workOrder" character varying(100),
        "warehouseId" character varying(80),
        "location" character varying(120),
        "quantity" numeric(18,6) NOT NULL DEFAULT 0,
        "uom" character varying(20) NOT NULL DEFAULT 'EA',
        "actualUnitCost" numeric(18,6) NOT NULL DEFAULT 0,
        "actualTotalCost" numeric(18,6) NOT NULL DEFAULT 0,
        "currency" character varying(3) NOT NULL DEFAULT 'USD',
        "costBasis" character varying(32) NOT NULL,
        "actorName" character varying(120),
        "description" character varying(255),
        "metadata" jsonb,
        "postedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transactions_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_transactions_tenant_posted" ON "transactions" ("tenant_id", "postedAt")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_transactions_tenant_source" ON "transactions" ("tenant_id", "sourceType", "sourceId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_transactions_journal" ON "transactions" ("journalId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_transactions_work_order" ON "transactions" ("workOrder")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_transactions_material" ON "transactions" ("materialPartNumber")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_transactions_material"');
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_transactions_work_order"',
    );
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_transactions_journal"');
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_transactions_tenant_source"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_transactions_tenant_posted"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "transactions"');
  }
}
