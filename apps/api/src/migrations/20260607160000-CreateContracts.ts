import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `contracts` — legal / compliance contract repository.
 * Fully additive: brand-new table, every column nullable or defaulted.
 * Idempotent (skips if TypeORM `synchronize` already created it on Railway).
 */
export class CreateContracts20260607160000 implements MigrationInterface {
  name = 'CreateContracts20260607160000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('contracts')) return;

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "contracts" (
        "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"       character varying(36),
        "organization_id" character varying(36),
        "plant_id"        character varying(36),
        "folio"           character varying(32),
        "title"           character varying(200) NOT NULL,
        "counterparty"    character varying(200),
        "type"            character varying(12) NOT NULL DEFAULT 'OTHER',
        "status"          character varying(12) NOT NULL DEFAULT 'DRAFT',
        "value"           double precision NOT NULL DEFAULT 0,
        "currency"        character varying(3) NOT NULL DEFAULT 'USD',
        "owner_email"     character varying(200),
        "auto_renew"      boolean NOT NULL DEFAULT false,
        "start_date"      TIMESTAMP,
        "end_date"        TIMESTAMP,
        "notes"           text,
        "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"      TIMESTAMP,
        "created_by"      character varying(255),
        CONSTRAINT "PK_contracts" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_contract_scope_status" ON "contracts" ("tenant_id", "plant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_contracts_folio" ON "contracts" ("folio")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_contracts_end_date" ON "contracts" ("end_date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('contracts')) {
      await queryRunner.query(`DROP TABLE "contracts"`);
    }
  }
}
