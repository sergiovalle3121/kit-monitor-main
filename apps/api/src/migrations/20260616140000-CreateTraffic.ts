import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Traffic (Tráfico) — logistics master data for the EMS shipping suite. Creates
 * the additive, prefixed, tenant-scoped tables `traffic_carriers`,
 * `traffic_vehicles`, `traffic_drivers`, `traffic_docks`, and adds the nullable
 * transport-assignment snapshot columns to `outbound_shipments`. Fully additive
 * and idempotent (hasTable / hasColumn guards); never drops or narrows anything.
 */
export class CreateTraffic20260616140000 implements MigrationInterface {
  name = 'CreateTraffic20260616140000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    if (!(await queryRunner.hasTable('traffic_carriers'))) {
      await queryRunner.query(`
        CREATE TABLE "traffic_carriers" (
          "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"       character varying(36),
          "organization_id" character varying(36),
          "plant_id"        character varying(36),
          "code"            character varying(32) NOT NULL,
          "name"            character varying(160) NOT NULL,
          "scac"            character varying(8),
          "tax_id"          character varying(40),
          "mode"            character varying(16) NOT NULL DEFAULT 'GROUND',
          "contact_name"    character varying(120),
          "contact_phone"   character varying(40),
          "contact_email"   character varying(160),
          "status"          character varying(16) NOT NULL DEFAULT 'active',
          "notes"           text,
          "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"      TIMESTAMP,
          "created_by"      character varying(255),
          CONSTRAINT "PK_traffic_carriers" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(`CREATE INDEX "idx_traffic_carrier_scope" ON "traffic_carriers" ("tenant_id", "plant_id")`);
      await queryRunner.query(`CREATE INDEX "IDX_traffic_carrier_code" ON "traffic_carriers" ("code")`);
    }

    if (!(await queryRunner.hasTable('traffic_vehicles'))) {
      await queryRunner.query(`
        CREATE TABLE "traffic_vehicles" (
          "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"       character varying(36),
          "organization_id" character varying(36),
          "plant_id"        character varying(36),
          "plate"           character varying(32) NOT NULL,
          "economic_number" character varying(32),
          "type"            character varying(24) NOT NULL DEFAULT 'DRY_VAN',
          "carrier_id"      character varying(36),
          "carrier_name"    character varying(160),
          "max_weight_kg"   double precision,
          "max_volume_m3"   double precision,
          "vin"             character varying(40),
          "status"          character varying(16) NOT NULL DEFAULT 'available',
          "notes"           text,
          "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"      TIMESTAMP,
          "created_by"      character varying(255),
          CONSTRAINT "PK_traffic_vehicles" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(`CREATE INDEX "idx_traffic_vehicle_scope" ON "traffic_vehicles" ("tenant_id", "plant_id")`);
      await queryRunner.query(`CREATE INDEX "IDX_traffic_vehicle_plate" ON "traffic_vehicles" ("plate")`);
      await queryRunner.query(`CREATE INDEX "IDX_traffic_vehicle_carrier" ON "traffic_vehicles" ("carrier_id")`);
    }

    if (!(await queryRunner.hasTable('traffic_drivers'))) {
      await queryRunner.query(`
        CREATE TABLE "traffic_drivers" (
          "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"       character varying(36),
          "organization_id" character varying(36),
          "plant_id"        character varying(36),
          "name"            character varying(160) NOT NULL,
          "license_number"  character varying(40),
          "license_type"    character varying(24),
          "phone"           character varying(40),
          "id_document"     character varying(40),
          "carrier_id"      character varying(36),
          "carrier_name"    character varying(160),
          "status"          character varying(16) NOT NULL DEFAULT 'available',
          "notes"           text,
          "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"      TIMESTAMP,
          "created_by"      character varying(255),
          CONSTRAINT "PK_traffic_drivers" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(`CREATE INDEX "idx_traffic_driver_scope" ON "traffic_drivers" ("tenant_id", "plant_id")`);
      await queryRunner.query(`CREATE INDEX "IDX_traffic_driver_carrier" ON "traffic_drivers" ("carrier_id")`);
    }

    if (!(await queryRunner.hasTable('traffic_docks'))) {
      await queryRunner.query(`
        CREATE TABLE "traffic_docks" (
          "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"       character varying(36),
          "organization_id" character varying(36),
          "plant_id"        character varying(36),
          "code"            character varying(32) NOT NULL,
          "name"            character varying(120),
          "building_id"     character varying(64),
          "building_name"   character varying(120),
          "type"            character varying(16) NOT NULL DEFAULT 'shipping',
          "status"          character varying(16) NOT NULL DEFAULT 'available',
          "notes"           text,
          "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"      TIMESTAMP,
          "created_by"      character varying(255),
          CONSTRAINT "PK_traffic_docks" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(`CREATE INDEX "idx_traffic_dock_scope" ON "traffic_docks" ("tenant_id", "plant_id")`);
      await queryRunner.query(`CREATE INDEX "IDX_traffic_dock_code" ON "traffic_docks" ("code")`);
    }

    // Additive transport-assignment columns on the outbound spine.
    if (await queryRunner.hasTable('outbound_shipments')) {
      const cols: { name: string; ddl: string }[] = [
        { name: 'carrier_id', ddl: 'character varying(36)' },
        { name: 'vehicle_id', ddl: 'character varying(36)' },
        { name: 'vehicle_plate', ddl: 'character varying(32)' },
        { name: 'vehicle_type', ddl: 'character varying(24)' },
        { name: 'driver_id', ddl: 'character varying(36)' },
        { name: 'driver_name', ddl: 'character varying(160)' },
        { name: 'dock_id', ddl: 'character varying(36)' },
        { name: 'dock_code', ddl: 'character varying(32)' },
        { name: 'transport_assigned_at', ddl: 'TIMESTAMP' },
        { name: 'transport_assigned_by', ddl: 'character varying(255)' },
      ];
      for (const c of cols) {
        if (!(await queryRunner.hasColumn('outbound_shipments', c.name))) {
          await queryRunner.query(
            `ALTER TABLE "outbound_shipments" ADD COLUMN "${c.name}" ${c.ddl}`,
          );
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('outbound_shipments')) {
      const cols = [
        'carrier_id',
        'vehicle_id',
        'vehicle_plate',
        'vehicle_type',
        'driver_id',
        'driver_name',
        'dock_id',
        'dock_code',
        'transport_assigned_at',
        'transport_assigned_by',
      ];
      for (const name of cols) {
        if (await queryRunner.hasColumn('outbound_shipments', name)) {
          await queryRunner.query(`ALTER TABLE "outbound_shipments" DROP COLUMN "${name}"`);
        }
      }
    }
    for (const t of ['traffic_docks', 'traffic_drivers', 'traffic_vehicles', 'traffic_carriers']) {
      if (await queryRunner.hasTable(t)) {
        await queryRunner.query(`DROP TABLE "${t}"`);
      }
    }
  }
}
