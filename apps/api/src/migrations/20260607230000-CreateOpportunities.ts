import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `crm_opportunities` — CRM sales pipeline.
 * Fully additive: brand-new table, every column nullable or defaulted.
 * Idempotent (skips if TypeORM `synchronize` already created it on Railway).
 */
export class CreateOpportunities20260607230000 implements MigrationInterface {
  name = 'CreateOpportunities20260607230000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('crm_opportunities')) return;

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "crm_opportunities" (
        "id"                  uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"           character varying(36),
        "organization_id"     character varying(36),
        "plant_id"            character varying(36),
        "folio"               character varying(32),
        "title"               character varying(200) NOT NULL,
        "customer_name"       character varying(200),
        "contact_name"        character varying(160),
        "status"              character varying(12) NOT NULL DEFAULT 'LEAD',
        "estimated_value"     double precision NOT NULL DEFAULT 0,
        "currency"            character varying(3) NOT NULL DEFAULT 'USD',
        "probability"         integer NOT NULL DEFAULT 10,
        "owner_email"         character varying(200),
        "program_id"          character varying(64),
        "notes"               text,
        "expected_close_date" TIMESTAMP,
        "closed_at"           TIMESTAMP,
        "created_at"          TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"          TIMESTAMP,
        "created_by"          character varying(255),
        CONSTRAINT "PK_crm_opportunities" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_opp_scope_status" ON "crm_opportunities" ("tenant_id", "plant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_crm_opportunities_folio" ON "crm_opportunities" ("folio")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_crm_opportunities_program" ON "crm_opportunities" ("program_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('crm_opportunities')) {
      await queryRunner.query(`DROP TABLE "crm_opportunities"`);
    }
  }
}
