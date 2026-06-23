import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Traffic (Tráfico) — dock appointments (Citas de andén). Creates the additive,
 * prefixed, tenant-scoped table `traffic_dock_appointments` (scheduling + gate
 * log). References the outbound shipment by id/folio (`shipment_ref`) only — no
 * FK, no coupling with outbound. Fully additive and idempotent (hasTable guard);
 * never drops or narrows anything.
 */
export class CreateDockAppointments20260623180000 implements MigrationInterface {
  name = 'CreateDockAppointments20260623180000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    if (!(await queryRunner.hasTable('traffic_dock_appointments'))) {
      await queryRunner.query(`
        CREATE TABLE "traffic_dock_appointments" (
          "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"       character varying(36),
          "organization_id" character varying(36),
          "plant_id"        character varying(36),
          "direction"       character varying(16) NOT NULL DEFAULT 'outbound',
          "scheduled_at"    TIMESTAMP NOT NULL,
          "window_end"      TIMESTAMP,
          "dock_id"         character varying(36),
          "dock_code"       character varying(32),
          "carrier_id"      character varying(36),
          "carrier_name"    character varying(160),
          "vehicle_id"      character varying(36),
          "vehicle_plate"   character varying(32),
          "driver_id"       character varying(36),
          "driver_name"     character varying(160),
          "shipment_ref"    character varying(64),
          "status"          character varying(16) NOT NULL DEFAULT 'scheduled',
          "arrived_at"      TIMESTAMP,
          "completed_at"    TIMESTAMP,
          "notes"           text,
          "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"      TIMESTAMP,
          "created_by"      character varying(255),
          CONSTRAINT "PK_traffic_dock_appointments" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "idx_traffic_appt_scope" ON "traffic_dock_appointments" ("tenant_id", "plant_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_traffic_appt_scheduled" ON "traffic_dock_appointments" ("scheduled_at")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_traffic_appt_dock" ON "traffic_dock_appointments" ("dock_id")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('traffic_dock_appointments')) {
      await queryRunner.query(`DROP TABLE "traffic_dock_appointments"`);
    }
  }
}
