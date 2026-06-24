import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the SPC DATA FOUNDATION tables (NOT SPC itself — control charts and
 * Cpk land in a later PR that consumes these):
 *   - qc_characteristics — CTQ catalog (nominal / USL / LSL / unit per model)
 *   - qc_measurements     — variable/attribute readings against a CTQ
 *
 * Fully additive: brand-new prefixed tables, every column nullable or defaulted,
 * no change to final_inspections or any existing quality table. Idempotent
 * (guarded by hasTable; skips when `synchronize` already created them). The
 * (characteristic_id, measured_at) index is intentional — the SPC PR reads
 * "all readings for a characteristic, ordered by time".
 */
export class CreateSpcDataFoundation20260623170000
  implements MigrationInterface
{
  name = 'CreateSpcDataFoundation20260623170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    if (!(await queryRunner.hasTable('qc_characteristics'))) {
      await queryRunner.query(`
        CREATE TABLE "qc_characteristics" (
          "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"       character varying(36),
          "organization_id" character varying(36),
          "plant_id"        character varying(36),
          "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"      TIMESTAMP,
          "created_by"      character varying(255),
          "code"            character varying(40) NOT NULL,
          "name"            character varying(200) NOT NULL,
          "model_id"        character varying(36),
          "operation_id"    character varying(36),
          "station"         character varying(120),
          "type"            character varying(16) NOT NULL DEFAULT 'VARIABLE',
          "unit"            character varying(24),
          "nominal"         double precision,
          "usl"             double precision,
          "lsl"             double precision,
          "is_critical"     boolean NOT NULL DEFAULT true,
          "active"          boolean NOT NULL DEFAULT true,
          "notes"           text,
          CONSTRAINT "PK_qc_characteristics" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "idx_qc_char_scope_model" ON "qc_characteristics" ("tenant_id", "plant_id", "model_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "idx_qc_char_scope_active" ON "qc_characteristics" ("tenant_id", "plant_id", "active")`,
      );
      await queryRunner.query(
        `CREATE INDEX "idx_qc_char_code" ON "qc_characteristics" ("code")`,
      );
    }

    if (!(await queryRunner.hasTable('qc_measurements'))) {
      await queryRunner.query(`
        CREATE TABLE "qc_measurements" (
          "id"                uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"         character varying(36),
          "organization_id"   character varying(36),
          "plant_id"          character varying(36),
          "created_at"        TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"        TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"        TIMESTAMP,
          "created_by"        character varying(255),
          "characteristic_id" character varying(36) NOT NULL,
          "value"             double precision,
          "passed"            boolean,
          "subgroup_id"       character varying(64),
          "subgroup_label"    character varying(120),
          "measured_at"       TIMESTAMP NOT NULL DEFAULT now(),
          "measured_by"       character varying(120),
          "source"            character varying(24) NOT NULL DEFAULT 'MANUAL',
          "reference"         character varying(120),
          "gage"              character varying(120),
          "notes"             text,
          CONSTRAINT "PK_qc_measurements" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "idx_qc_meas_char_time" ON "qc_measurements" ("characteristic_id", "measured_at")`,
      );
      await queryRunner.query(
        `CREATE INDEX "idx_qc_meas_scope_char_time" ON "qc_measurements" ("tenant_id", "characteristic_id", "measured_at")`,
      );
      await queryRunner.query(
        `CREATE INDEX "idx_qc_meas_subgroup" ON "qc_measurements" ("characteristic_id", "subgroup_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "idx_qc_meas_measured_at" ON "qc_measurements" ("measured_at")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('qc_measurements')) {
      await queryRunner.query(`DROP TABLE "qc_measurements"`);
    }
    if (await queryRunner.hasTable('qc_characteristics')) {
      await queryRunner.query(`DROP TABLE "qc_characteristics"`);
    }
  }
}
