import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductionTopology20260423150000 implements MigrationInterface {
  name = 'CreateProductionTopology20260423150000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "enterprise_areas" (
        "id" character varying(64) NOT NULL,
        "building_id" character varying(64) NOT NULL,
        "code" character varying(32) NOT NULL,
        "name" character varying(120) NOT NULL,
        "type" character varying(24) NOT NULL,
        "status" character varying(24) NOT NULL DEFAULT 'active',
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_enterprise_areas_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_enterprise_areas_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "enterprise_lines" (
        "id" character varying(64) NOT NULL,
        "building_id" character varying(64) NOT NULL,
        "area_id" character varying(64) NOT NULL,
        "code" character varying(32) NOT NULL,
        "name" character varying(120) NOT NULL,
        "status" character varying(24) NOT NULL DEFAULT 'active',
        "legacyLineNumber" integer,
        "capacityPerShift" integer NOT NULL DEFAULT 0,
        "activeShift" character varying(8),
        "tags" text NOT NULL DEFAULT '',
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_enterprise_lines_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_enterprise_lines_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "enterprise_stations" (
        "id" character varying(64) NOT NULL,
        "line_id" character varying(64) NOT NULL,
        "code" character varying(32) NOT NULL,
        "position" integer NOT NULL,
        "status" character varying(24) NOT NULL DEFAULT 'active',
        "metadata" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_enterprise_stations_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "enterprise_plan_links" (
        "id" SERIAL NOT NULL,
        "plan_id" integer NOT NULL,
        "program_id" character varying(64),
        "building_id" character varying(64),
        "line_id" character varying(64),
        "mappingMethod" character varying(24) NOT NULL DEFAULT 'explicit',
        "confidenceScore" double precision NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_enterprise_plan_links_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_enterprise_plan_links_plan" ON "enterprise_plan_links" ("plan_id")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_enterprise_stations_line_pos" ON "enterprise_stations" ("line_id", "position")',
    );

    await queryRunner.query(`
      ALTER TABLE "enterprise_areas"
      ADD CONSTRAINT "FK_enterprise_areas_building"
      FOREIGN KEY ("building_id") REFERENCES "enterprise_buildings"("id")
      ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "enterprise_lines"
      ADD CONSTRAINT "FK_enterprise_lines_building"
      FOREIGN KEY ("building_id") REFERENCES "enterprise_buildings"("id")
      ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "enterprise_lines"
      ADD CONSTRAINT "FK_enterprise_lines_area"
      FOREIGN KEY ("area_id") REFERENCES "enterprise_areas"("id")
      ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "enterprise_stations"
      ADD CONSTRAINT "FK_enterprise_stations_line"
      FOREIGN KEY ("line_id") REFERENCES "enterprise_lines"("id")
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "enterprise_plan_links"
      ADD CONSTRAINT "FK_enterprise_plan_links_plan"
      FOREIGN KEY ("plan_id") REFERENCES "plans"("id")
      ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "enterprise_plan_links"
      ADD CONSTRAINT "FK_enterprise_plan_links_program"
      FOREIGN KEY ("program_id") REFERENCES "enterprise_programs"("id")
      ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "enterprise_plan_links"
      ADD CONSTRAINT "FK_enterprise_plan_links_building"
      FOREIGN KEY ("building_id") REFERENCES "enterprise_buildings"("id")
      ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "enterprise_plan_links"
      ADD CONSTRAINT "FK_enterprise_plan_links_line"
      FOREIGN KEY ("line_id") REFERENCES "enterprise_lines"("id")
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "enterprise_plan_links" DROP CONSTRAINT IF EXISTS "FK_enterprise_plan_links_line"',
    );
    await queryRunner.query(
      'ALTER TABLE "enterprise_plan_links" DROP CONSTRAINT IF EXISTS "FK_enterprise_plan_links_building"',
    );
    await queryRunner.query(
      'ALTER TABLE "enterprise_plan_links" DROP CONSTRAINT IF EXISTS "FK_enterprise_plan_links_program"',
    );
    await queryRunner.query(
      'ALTER TABLE "enterprise_plan_links" DROP CONSTRAINT IF EXISTS "FK_enterprise_plan_links_plan"',
    );
    await queryRunner.query(
      'ALTER TABLE "enterprise_stations" DROP CONSTRAINT IF EXISTS "FK_enterprise_stations_line"',
    );
    await queryRunner.query(
      'ALTER TABLE "enterprise_lines" DROP CONSTRAINT IF EXISTS "FK_enterprise_lines_area"',
    );
    await queryRunner.query(
      'ALTER TABLE "enterprise_lines" DROP CONSTRAINT IF EXISTS "FK_enterprise_lines_building"',
    );
    await queryRunner.query(
      'ALTER TABLE "enterprise_areas" DROP CONSTRAINT IF EXISTS "FK_enterprise_areas_building"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "UQ_enterprise_stations_line_pos"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "UQ_enterprise_plan_links_plan"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "enterprise_plan_links"');
    await queryRunner.query('DROP TABLE IF EXISTS "enterprise_stations"');
    await queryRunner.query('DROP TABLE IF EXISTS "enterprise_lines"');
    await queryRunner.query('DROP TABLE IF EXISTS "enterprise_areas"');
  }
}
