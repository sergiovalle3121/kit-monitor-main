import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Block D — Operator terminal. Creates `sf_consumption_events` (immutable
 * backflush records, idempotent) and `sf_floor_events` (andon / defect /
 * downtime). Fully additive, prefixed tables, all columns nullable/defaulted.
 * Idempotent.
 */
export class CreateOperatorTerminal20260607210000 implements MigrationInterface {
  name = 'CreateOperatorTerminal20260607210000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    if (!(await queryRunner.hasTable('sf_consumption_events'))) {
      await queryRunner.query(`
        CREATE TABLE "sf_consumption_events" (
          "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"       character varying(36),
          "organization_id" character varying(36),
          "plant_id"        character varying(36),
          "idempotency_key" character varying(80) NOT NULL,
          "wo_id"           character varying(36) NOT NULL,
          "wo_folio"        character varying(32),
          "model"           character varying(64) NOT NULL,
          "station"         character varying(32) NOT NULL,
          "part"            character varying(64),
          "units"           double precision NOT NULL DEFAULT 1,
          "backflush_qty"   double precision NOT NULL DEFAULT 0,
          "unit_serial"     character varying(80),
          "operator_email"  character varying(200),
          "outbox_status"   character varying(16) NOT NULL DEFAULT 'PENDING',
          "program_id"      character varying(64),
          "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"      TIMESTAMP,
          "created_by"      character varying(255),
          CONSTRAINT "PK_sf_consumption_events" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(`CREATE UNIQUE INDEX "UQ_sf_consumption_idem" ON "sf_consumption_events" ("idempotency_key")`);
      await queryRunner.query(`CREATE INDEX "idx_sf_consumption_wo" ON "sf_consumption_events" ("wo_id")`);
      await queryRunner.query(`CREATE INDEX "idx_sf_consumption_scope" ON "sf_consumption_events" ("tenant_id", "plant_id")`);
      await queryRunner.query(`CREATE INDEX "IDX_sf_consumption_serial" ON "sf_consumption_events" ("unit_serial")`);
    }

    if (!(await queryRunner.hasTable('sf_floor_events'))) {
      await queryRunner.query(`
        CREATE TABLE "sf_floor_events" (
          "id"               uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"        character varying(36),
          "organization_id"  character varying(36),
          "plant_id"         character varying(36),
          "type"             character varying(20) NOT NULL,
          "wo_id"            character varying(36),
          "wo_folio"         character varying(32),
          "line"             character varying(32),
          "station"          character varying(32),
          "model"            character varying(64),
          "part"             character varying(64),
          "severity"         character varying(8) NOT NULL DEFAULT 'MEDIUM',
          "status"           character varying(16) NOT NULL DEFAULT 'OPEN',
          "target_role"      character varying(32),
          "escalation_level" integer NOT NULL DEFAULT 0,
          "downtime_code"    character varying(32),
          "downtime_minutes" double precision NOT NULL DEFAULT 0,
          "note"             character varying(500),
          "raised_at"        TIMESTAMP,
          "raised_by"        character varying(200),
          "acknowledged_at"  TIMESTAMP,
          "resolved_at"      TIMESTAMP,
          "resolved_by"      character varying(200),
          "program_id"       character varying(64),
          "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"       TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"       TIMESTAMP,
          "created_by"       character varying(255),
          CONSTRAINT "PK_sf_floor_events" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(`CREATE INDEX "idx_sf_floor_scope_status" ON "sf_floor_events" ("tenant_id", "plant_id", "status")`);
      await queryRunner.query(`CREATE INDEX "idx_sf_floor_line" ON "sf_floor_events" ("line", "status")`);
      await queryRunner.query(`CREATE INDEX "IDX_sf_floor_type" ON "sf_floor_events" ("type")`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('sf_floor_events')) await queryRunner.query(`DROP TABLE "sf_floor_events"`);
    if (await queryRunner.hasTable('sf_consumption_events')) await queryRunner.query(`DROP TABLE "sf_consumption_events"`);
  }
}
