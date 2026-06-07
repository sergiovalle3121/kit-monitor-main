import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Block C — Material staging + e-kanban. Creates `sf_staging` (kit lines per WO
 * station) and `sf_replenish_calls` (pull replenishment). Fully additive,
 * prefixed tables, all columns nullable/defaulted. Idempotent.
 */
export class CreateMaterialStaging20260607200000 implements MigrationInterface {
  name = 'CreateMaterialStaging20260607200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    if (!(await queryRunner.hasTable('sf_staging'))) {
      await queryRunner.query(`
        CREATE TABLE "sf_staging" (
          "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"       character varying(36),
          "organization_id" character varying(36),
          "plant_id"        character varying(36),
          "wo_id"           character varying(36) NOT NULL,
          "wo_folio"        character varying(32),
          "model"           character varying(64) NOT NULL,
          "station"         character varying(32) NOT NULL,
          "sequence"        integer NOT NULL DEFAULT 1,
          "part"            character varying(64) NOT NULL,
          "required_qty"    double precision NOT NULL DEFAULT 0,
          "staged_qty"      double precision NOT NULL DEFAULT 0,
          "min_qty"         double precision NOT NULL DEFAULT 0,
          "status"          character varying(16) NOT NULL DEFAULT 'PENDING',
          "feeder_position" character varying(48),
          "program_id"      character varying(64),
          "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"      TIMESTAMP,
          "created_by"      character varying(255),
          CONSTRAINT "PK_sf_staging" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(`CREATE INDEX "idx_sf_staging_wo" ON "sf_staging" ("wo_id")`);
      await queryRunner.query(`CREATE INDEX "idx_sf_staging_scope" ON "sf_staging" ("tenant_id", "plant_id", "status")`);
      await queryRunner.query(`CREATE INDEX "IDX_sf_staging_part" ON "sf_staging" ("part")`);
    }

    if (!(await queryRunner.hasTable('sf_replenish_calls'))) {
      await queryRunner.query(`
        CREATE TABLE "sf_replenish_calls" (
          "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id"       character varying(36),
          "organization_id" character varying(36),
          "plant_id"        character varying(36),
          "wo_id"           character varying(36) NOT NULL,
          "wo_folio"        character varying(32),
          "station"         character varying(32) NOT NULL,
          "part"            character varying(64) NOT NULL,
          "qty"             double precision NOT NULL DEFAULT 0,
          "priority"        character varying(8) NOT NULL DEFAULT 'MEDIUM',
          "status"          character varying(16) NOT NULL DEFAULT 'OPEN',
          "reason"          character varying(32),
          "raised_at"       TIMESTAMP,
          "raised_by"       character varying(200),
          "delivered_at"    TIMESTAMP,
          "delivered_by"    character varying(200),
          "program_id"      character varying(64),
          "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at"      TIMESTAMP,
          "created_by"      character varying(255),
          CONSTRAINT "PK_sf_replenish_calls" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(`CREATE INDEX "idx_sf_replenish_scope" ON "sf_replenish_calls" ("tenant_id", "plant_id", "status")`);
      await queryRunner.query(`CREATE INDEX "idx_sf_replenish_wo" ON "sf_replenish_calls" ("wo_id")`);
      await queryRunner.query(`CREATE INDEX "IDX_sf_replenish_part" ON "sf_replenish_calls" ("part")`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('sf_replenish_calls')) await queryRunner.query(`DROP TABLE "sf_replenish_calls"`);
    if (await queryRunner.hasTable('sf_staging')) await queryRunner.query(`DROP TABLE "sf_staging"`);
  }
}
