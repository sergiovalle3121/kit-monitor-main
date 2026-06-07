import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Block B — Plan publication / work orders. Creates `sf_work_orders`.
 * Fully additive: brand-new prefixed table (avoids the legacy `work_orders`/plan
 * tables), every column nullable or defaulted. Idempotent.
 */
export class CreateSfWorkOrders20260607190000 implements MigrationInterface {
  name = 'CreateSfWorkOrders20260607190000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('sf_work_orders')) return;
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "sf_work_orders" (
        "id"                   uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"            character varying(36),
        "organization_id"      character varying(36),
        "plant_id"             character varying(36),
        "folio"                character varying(32),
        "model"                character varying(64) NOT NULL,
        "revision"             character varying(16) NOT NULL DEFAULT 'A',
        "line"                 character varying(32) NOT NULL,
        "bay"                  character varying(32),
        "quantity_planned"     integer NOT NULL DEFAULT 0,
        "quantity_completed"   integer NOT NULL DEFAULT 0,
        "scheduled_date"       TIMESTAMP,
        "sequence"             integer NOT NULL DEFAULT 100,
        "priority"             character varying(8) NOT NULL DEFAULT 'MEDIUM',
        "status"               character varying(16) NOT NULL DEFAULT 'RELEASED',
        "consumption_mode"     character varying(16) NOT NULL DEFAULT 'BY_UNIT',
        "serial_control"       character varying(8) NOT NULL DEFAULT 'NONE',
        "takt_target_sec"      double precision NOT NULL DEFAULT 0,
        "material_ready"       boolean NOT NULL DEFAULT false,
        "quality_clear"        boolean NOT NULL DEFAULT true,
        "fai_required"         boolean NOT NULL DEFAULT false,
        "fai_approved"         boolean NOT NULL DEFAULT false,
        "authorized_operators" jsonb,
        "program_id"           character varying(64),
        "customer"             character varying(200),
        "published_by"         character varying(200),
        "published_at"         TIMESTAMP,
        "started_at"           TIMESTAMP,
        "completed_at"         TIMESTAMP,
        "notes"                character varying(255),
        "created_at"           TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"           TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"           TIMESTAMP,
        "created_by"           character varying(255),
        CONSTRAINT "PK_sf_work_orders" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_sf_wo_scope_status" ON "sf_work_orders" ("tenant_id", "plant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sf_wo_line" ON "sf_work_orders" ("line", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sf_work_orders_folio" ON "sf_work_orders" ("folio")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sf_work_orders_model" ON "sf_work_orders" ("model")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('sf_work_orders')) {
      await queryRunner.query(`DROP TABLE "sf_work_orders"`);
    }
  }
}
