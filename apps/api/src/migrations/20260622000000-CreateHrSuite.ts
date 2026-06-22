import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the HR / Capital Humano suite — workforce master + talent acquisition
 * + performance + attendance. Fully additive: brand-new tables prefixed `hr_`,
 * every column nullable or defaulted. Idempotent (skips each table if TypeORM
 * `synchronize` already created it on Railway).
 */
export class CreateHrSuite20260622000000 implements MigrationInterface {
  name = 'CreateHrSuite20260622000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    if (!(await queryRunner.hasTable('hr_employees'))) {
      await queryRunner.query(`
        CREATE TABLE "hr_employees" (
          "id"                       uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"                character varying(36),
          "organization_id"          character varying(36),
          "plant_id"                 character varying(36),
          "created_at"               TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"               TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"               TIMESTAMP,
          "created_by"               character varying(255),
          "folio"                    character varying(32),
          "employee_number"          character varying(40),
          "first_name"               character varying(120) NOT NULL,
          "last_name"                character varying(120) NOT NULL,
          "email"                    character varying(200),
          "position"                 character varying(160),
          "area"                     character varying(120),
          "department"               character varying(120),
          "cost_center"              character varying(60),
          "shift"                    character varying(20),
          "line"                     character varying(60),
          "station"                  character varying(60),
          "labor_type"               character varying(12) NOT NULL DEFAULT 'DIRECT',
          "employment_type"          character varying(16) NOT NULL DEFAULT 'FULL_TIME',
          "status"                   character varying(16) NOT NULL DEFAULT 'ACTIVE',
          "hire_date"                TIMESTAMP,
          "termination_date"         TIMESTAMP,
          "termination_type"         character varying(16),
          "termination_reason"       character varying(200),
          "birth_date"               TIMESTAMP,
          "gender"                   character varying(16),
          "monthly_cost"             double precision,
          "supervisor_name"          character varying(160),
          "manager_employee_number"  character varying(40),
          "engagement_score"         double precision,
          CONSTRAINT "PK_hr_employees" PRIMARY KEY ("id")
        )`);
      await queryRunner.query(`CREATE INDEX "idx_hr_emp_scope_status" ON "hr_employees" ("tenant_id", "plant_id", "status")`);
      await queryRunner.query(`CREATE INDEX "IDX_hr_emp_number" ON "hr_employees" ("employee_number")`);
      await queryRunner.query(`CREATE INDEX "IDX_hr_emp_folio" ON "hr_employees" ("folio")`);
      await queryRunner.query(`CREATE INDEX "IDX_hr_emp_area" ON "hr_employees" ("area")`);
      await queryRunner.query(`CREATE INDEX "IDX_hr_emp_shift" ON "hr_employees" ("shift")`);
      await queryRunner.query(`CREATE INDEX "IDX_hr_emp_hire" ON "hr_employees" ("hire_date")`);
    }

    if (!(await queryRunner.hasTable('hr_requisitions'))) {
      await queryRunner.query(`
        CREATE TABLE "hr_requisitions" (
          "id"               uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"        character varying(36),
          "organization_id"  character varying(36),
          "plant_id"         character varying(36),
          "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"       TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"       TIMESTAMP,
          "created_by"       character varying(255),
          "folio"            character varying(32),
          "title"            character varying(160) NOT NULL,
          "area"             character varying(120),
          "department"       character varying(120),
          "cost_center"      character varying(60),
          "shift"            character varying(20),
          "line"             character varying(60),
          "labor_type"       character varying(12) NOT NULL DEFAULT 'DIRECT',
          "openings"         integer NOT NULL DEFAULT 1,
          "filled_count"     integer NOT NULL DEFAULT 0,
          "status"           character varying(16) NOT NULL DEFAULT 'OPEN',
          "priority"         character varying(12) NOT NULL DEFAULT 'MEDIUM',
          "reason"           character varying(16) NOT NULL DEFAULT 'GROWTH',
          "program"          character varying(120),
          "customer"         character varying(120),
          "hiring_manager"   character varying(160),
          "opened_date"      TIMESTAMP,
          "target_fill_date" TIMESTAMP,
          "filled_date"      TIMESTAMP,
          CONSTRAINT "PK_hr_requisitions" PRIMARY KEY ("id")
        )`);
      await queryRunner.query(`CREATE INDEX "idx_hr_req_scope_status" ON "hr_requisitions" ("tenant_id", "plant_id", "status")`);
      await queryRunner.query(`CREATE INDEX "IDX_hr_req_folio" ON "hr_requisitions" ("folio")`);
      await queryRunner.query(`CREATE INDEX "IDX_hr_req_area" ON "hr_requisitions" ("area")`);
      await queryRunner.query(`CREATE INDEX "IDX_hr_req_opened" ON "hr_requisitions" ("opened_date")`);
    }

    if (!(await queryRunner.hasTable('hr_candidates'))) {
      await queryRunner.query(`
        CREATE TABLE "hr_candidates" (
          "id"                 uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"          character varying(36),
          "organization_id"    character varying(36),
          "plant_id"           character varying(36),
          "created_at"         TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"         TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"         TIMESTAMP,
          "created_by"         character varying(255),
          "requisition_id"     uuid,
          "requisition_folio"  character varying(32),
          "name"               character varying(160) NOT NULL,
          "email"              character varying(200),
          "phone"              character varying(40),
          "source"             character varying(20),
          "stage"              character varying(16) NOT NULL DEFAULT 'APPLIED',
          "rating"             integer,
          "applied_date"       TIMESTAMP,
          "stage_updated_date" TIMESTAMP,
          "hired_date"         TIMESTAMP,
          "notes"              text,
          CONSTRAINT "PK_hr_candidates" PRIMARY KEY ("id")
        )`);
      await queryRunner.query(`CREATE INDEX "idx_hr_cand_scope_stage" ON "hr_candidates" ("tenant_id", "plant_id", "stage")`);
      await queryRunner.query(`CREATE INDEX "IDX_hr_cand_req" ON "hr_candidates" ("requisition_id")`);
      await queryRunner.query(`CREATE INDEX "IDX_hr_cand_applied" ON "hr_candidates" ("applied_date")`);
    }

    if (!(await queryRunner.hasTable('hr_performance_reviews'))) {
      await queryRunner.query(`
        CREATE TABLE "hr_performance_reviews" (
          "id"                   uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"            character varying(36),
          "organization_id"      character varying(36),
          "plant_id"             character varying(36),
          "created_at"           TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"           TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"           TIMESTAMP,
          "created_by"           character varying(255),
          "folio"                character varying(32),
          "employee_id"          uuid,
          "employee_number"      character varying(40),
          "employee_name"        character varying(160) NOT NULL,
          "area"                 character varying(120),
          "department"           character varying(120),
          "period"               character varying(16) NOT NULL,
          "reviewer"             character varying(160),
          "performance_score"    double precision,
          "potential"            character varying(8),
          "nine_box_key"         character varying(24),
          "status"               character varying(16) NOT NULL DEFAULT 'DRAFT',
          "goals_met_pct"        double precision,
          "succession_readiness" character varying(16),
          "comments"             text,
          "review_date"          TIMESTAMP,
          CONSTRAINT "PK_hr_performance_reviews" PRIMARY KEY ("id")
        )`);
      await queryRunner.query(`CREATE INDEX "idx_hr_review_scope_period" ON "hr_performance_reviews" ("tenant_id", "plant_id", "period")`);
      await queryRunner.query(`CREATE INDEX "IDX_hr_review_folio" ON "hr_performance_reviews" ("folio")`);
      await queryRunner.query(`CREATE INDEX "IDX_hr_review_emp" ON "hr_performance_reviews" ("employee_id")`);
    }

    if (!(await queryRunner.hasTable('hr_absences'))) {
      await queryRunner.query(`
        CREATE TABLE "hr_absences" (
          "id"               uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"        character varying(36),
          "organization_id"  character varying(36),
          "plant_id"         character varying(36),
          "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"       TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"       TIMESTAMP,
          "created_by"       character varying(255),
          "employee_id"      uuid,
          "employee_number"  character varying(40),
          "employee_name"    character varying(160) NOT NULL,
          "area"             character varying(120),
          "shift"            character varying(20),
          "line"             character varying(60),
          "date"             TIMESTAMP,
          "type"             character varying(16) NOT NULL DEFAULT 'ABSENCE',
          "justified"        boolean NOT NULL DEFAULT false,
          "hours"            double precision NOT NULL DEFAULT 0,
          "reason"           character varying(200),
          CONSTRAINT "PK_hr_absences" PRIMARY KEY ("id")
        )`);
      await queryRunner.query(`CREATE INDEX "idx_hr_abs_scope_date" ON "hr_absences" ("tenant_id", "plant_id", "date")`);
      await queryRunner.query(`CREATE INDEX "IDX_hr_abs_emp" ON "hr_absences" ("employee_id")`);
      await queryRunner.query(`CREATE INDEX "IDX_hr_abs_date" ON "hr_absences" ("date")`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'hr_absences',
      'hr_performance_reviews',
      'hr_candidates',
      'hr_requisitions',
      'hr_employees',
    ]) {
      if (await queryRunner.hasTable(table)) {
        await queryRunner.query(`DROP TABLE "${table}"`);
      }
    }
  }
}
