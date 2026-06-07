import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `expense_reports` — employee expenses / travel (FIN / AP).
 * Fully additive: brand-new table, every column nullable or defaulted.
 * Idempotent (skips if TypeORM `synchronize` already created it on Railway).
 */
export class CreateExpenseReports20260607250000 implements MigrationInterface {
  name = 'CreateExpenseReports20260607250000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('expense_reports')) return;

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "expense_reports" (
        "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"       character varying(36),
        "organization_id" character varying(36),
        "plant_id"        character varying(36),
        "folio"           character varying(32),
        "employee_name"   character varying(160) NOT NULL,
        "description"     character varying(200) NOT NULL,
        "category"        character varying(12) NOT NULL DEFAULT 'OTHER',
        "amount"          double precision NOT NULL DEFAULT 0,
        "currency"        character varying(3) NOT NULL DEFAULT 'USD',
        "status"          character varying(12) NOT NULL DEFAULT 'DRAFT',
        "approver_email"  character varying(200),
        "reject_reason"   character varying(255),
        "program_id"      character varying(64),
        "expense_date"    TIMESTAMP,
        "approved_at"     TIMESTAMP,
        "reimbursed_at"   TIMESTAMP,
        "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"      TIMESTAMP,
        "created_by"      character varying(255),
        CONSTRAINT "PK_expense_reports" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_expense_scope_status" ON "expense_reports" ("tenant_id", "plant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_expense_reports_folio" ON "expense_reports" ("folio")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_expense_reports_employee" ON "expense_reports" ("employee_name")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_expense_reports_program" ON "expense_reports" ("program_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('expense_reports')) {
      await queryRunner.query(`DROP TABLE "expense_reports"`);
    }
  }
}
