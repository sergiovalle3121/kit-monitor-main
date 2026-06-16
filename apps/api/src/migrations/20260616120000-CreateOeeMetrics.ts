import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Block H — OEE / shop-floor metrics. Creates `sf_downtime_events` (categorised
 * stops → Availability) and `sf_hxh_target` (hour-by-hour meta). Fully additive,
 * prefixed tables, every column nullable/defaulted. Idempotent (guarded by
 * hasTable) so it is a no-op against an already-materialised schema.
 */
export class CreateOeeMetrics20260616120000 implements MigrationInterface {
  name = 'CreateOeeMetrics20260616120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    if (!(await queryRunner.hasTable('sf_downtime_events'))) {
      await queryRunner.query(`
        CREATE TABLE "sf_downtime_events" (
          "id"               uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"        character varying(36),
          "organization_id"  character varying(36),
          "plant_id"         character varying(36),
          "line"             character varying(32) NOT NULL,
          "station"          character varying(32),
          "wo_id"            character varying(36),
          "wo_folio"         character varying(32),
          "model"            character varying(64),
          "reason_code"      character varying(16) NOT NULL DEFAULT 'OTHER',
          "reason_note"      character varying(500),
          "status"           character varying(8) NOT NULL DEFAULT 'OPEN',
          "start_at"         TIMESTAMP NOT NULL DEFAULT now(),
          "end_at"           TIMESTAMP,
          "duration_minutes" double precision NOT NULL DEFAULT 0,
          "opened_by"        character varying(200),
          "closed_by"        character varying(200),
          "program_id"       character varying(64),
          "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"       TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"       TIMESTAMP,
          "created_by"       character varying(255),
          CONSTRAINT "PK_sf_downtime_events" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "idx_sf_downtime_scope_status" ON "sf_downtime_events" ("tenant_id", "plant_id", "status")`,
      );
      await queryRunner.query(
        `CREATE INDEX "idx_sf_downtime_line_status" ON "sf_downtime_events" ("line", "status")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_sf_downtime_reason" ON "sf_downtime_events" ("reason_code")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_sf_downtime_line" ON "sf_downtime_events" ("line")`,
      );
    }

    if (!(await queryRunner.hasTable('sf_hxh_target'))) {
      await queryRunner.query(`
        CREATE TABLE "sf_hxh_target" (
          "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"       character varying(36),
          "organization_id" character varying(36),
          "plant_id"        character varying(36),
          "line"            character varying(32) NOT NULL,
          "shift"           character varying(16) NOT NULL DEFAULT 'A',
          "hour"            integer NOT NULL,
          "target_qty"      integer NOT NULL DEFAULT 0,
          "model"           character varying(64),
          "effective_date"  character varying(10),
          "notes"           character varying(255),
          "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"      TIMESTAMP,
          "created_by"      character varying(255),
          CONSTRAINT "PK_sf_hxh_target" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "idx_sf_hxh_scope" ON "sf_hxh_target" ("tenant_id", "plant_id", "line")`,
      );
      await queryRunner.query(
        `CREATE INDEX "idx_sf_hxh_line_shift" ON "sf_hxh_target" ("line", "shift")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_sf_hxh_line" ON "sf_hxh_target" ("line")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('sf_hxh_target'))
      await queryRunner.query(`DROP TABLE "sf_hxh_target"`);
    if (await queryRunner.hasTable('sf_downtime_events'))
      await queryRunner.query(`DROP TABLE "sf_downtime_events"`);
  }
}
