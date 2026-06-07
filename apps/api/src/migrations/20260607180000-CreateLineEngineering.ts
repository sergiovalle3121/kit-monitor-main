import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Block A — Industrial Engineering line disposition.
 * Creates `sf_line_stations` (station layout / routing) and `sf_model_lines`
 * (model↔line qualification). Fully additive: brand-new prefixed tables, every
 * column nullable or defaulted. Idempotent (skips if synchronize already made
 * them on Railway).
 */
export class CreateLineEngineering20260607180000 implements MigrationInterface {
  name = 'CreateLineEngineering20260607180000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    if (!(await queryRunner.hasTable('sf_line_stations'))) {
      await queryRunner.query(`
        CREATE TABLE "sf_line_stations" (
          "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"       character varying(36),
          "organization_id" character varying(36),
          "plant_id"        character varying(36),
          "model"           character varying(64) NOT NULL,
          "revision"        character varying(16) NOT NULL DEFAULT 'A',
          "line"            character varying(32) NOT NULL,
          "station"         character varying(32) NOT NULL,
          "sequence"        integer NOT NULL DEFAULT 1,
          "np_expected"     character varying(64),
          "use_factor"      double precision NOT NULL DEFAULT 1,
          "std_time_sec"    double precision NOT NULL DEFAULT 0,
          "feeder_position" character varying(48),
          "visual_aid_url"  character varying(512),
          "ctq"             boolean NOT NULL DEFAULT false,
          "program_id"      character varying(64),
          "notes"           character varying(255),
          "active"          boolean NOT NULL DEFAULT true,
          "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"      TIMESTAMP,
          "created_by"      character varying(255),
          CONSTRAINT "PK_sf_line_stations" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "idx_sf_station_scope" ON "sf_line_stations" ("tenant_id", "plant_id", "model", "revision")`,
      );
      await queryRunner.query(
        `CREATE INDEX "idx_sf_station_line" ON "sf_line_stations" ("line")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_sf_line_stations_model" ON "sf_line_stations" ("model")`,
      );
    }

    if (!(await queryRunner.hasTable('sf_model_lines'))) {
      await queryRunner.query(`
        CREATE TABLE "sf_model_lines" (
          "id"                 uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"          character varying(36),
          "organization_id"    character varying(36),
          "plant_id"           character varying(36),
          "model"              character varying(64) NOT NULL,
          "revision"           character varying(16) NOT NULL DEFAULT 'A',
          "line"               character varying(32) NOT NULL,
          "changeover_minutes" double precision NOT NULL DEFAULT 0,
          "takt_target_sec"    double precision NOT NULL DEFAULT 0,
          "program_id"         character varying(64),
          "active"             boolean NOT NULL DEFAULT true,
          "notes"              character varying(255),
          "created_at"         TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"         TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"         TIMESTAMP,
          "created_by"         character varying(255),
          CONSTRAINT "PK_sf_model_lines" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "idx_sf_modelline_scope" ON "sf_model_lines" ("tenant_id", "plant_id", "model", "line")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_sf_model_lines_line" ON "sf_model_lines" ("line")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('sf_model_lines')) {
      await queryRunner.query(`DROP TABLE "sf_model_lines"`);
    }
    if (await queryRunner.hasTable('sf_line_stations')) {
      await queryRunner.query(`DROP TABLE "sf_line_stations"`);
    }
  }
}
