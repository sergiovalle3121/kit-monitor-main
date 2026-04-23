import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEnterpriseDimensions20260423120000 implements MigrationInterface {
  name = 'CreateEnterpriseDimensions20260423120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "enterprise_buildings" (
        "id" character varying(64) NOT NULL,
        "code" character varying(32) NOT NULL,
        "name" character varying(120) NOT NULL,
        "status" character varying(24) NOT NULL DEFAULT 'active',
        "tags" text NOT NULL DEFAULT '',
        "activeShifts" text NOT NULL DEFAULT 'A,B,C',
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_enterprise_buildings_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_enterprise_buildings_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "enterprise_customers" (
        "id" character varying(64) NOT NULL,
        "code" character varying(32) NOT NULL,
        "name" character varying(120) NOT NULL,
        "industry" character varying(80),
        "status" character varying(24) NOT NULL DEFAULT 'active',
        "metadata" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_enterprise_customers_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_enterprise_customers_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "enterprise_programs" (
        "id" character varying(64) NOT NULL,
        "customer_id" character varying(64) NOT NULL,
        "dedicated_building_id" character varying(64),
        "code" character varying(32) NOT NULL,
        "name" character varying(160) NOT NULL,
        "status" character varying(24) NOT NULL DEFAULT 'active',
        "primaryModelPrefix" character varying(40),
        "metadata" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_enterprise_programs_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_enterprise_programs_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "enterprise_warehouses" (
        "id" character varying(64) NOT NULL,
        "building_id" character varying(64),
        "code" character varying(32) NOT NULL,
        "name" character varying(120) NOT NULL,
        "type" character varying(24) NOT NULL,
        "status" character varying(24) NOT NULL DEFAULT 'active',
        "locationCount" integer NOT NULL DEFAULT 0,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "metadata" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_enterprise_warehouses_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_enterprise_warehouses_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "enterprise_programs"
      ADD CONSTRAINT "FK_enterprise_programs_customer"
      FOREIGN KEY ("customer_id") REFERENCES "enterprise_customers"("id")
      ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE "enterprise_programs"
      ADD CONSTRAINT "FK_enterprise_programs_building"
      FOREIGN KEY ("dedicated_building_id") REFERENCES "enterprise_buildings"("id")
      ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "enterprise_warehouses"
      ADD CONSTRAINT "FK_enterprise_warehouses_building"
      FOREIGN KEY ("building_id") REFERENCES "enterprise_buildings"("id")
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "enterprise_warehouses" DROP CONSTRAINT IF EXISTS "FK_enterprise_warehouses_building"');
    await queryRunner.query('ALTER TABLE "enterprise_programs" DROP CONSTRAINT IF EXISTS "FK_enterprise_programs_building"');
    await queryRunner.query('ALTER TABLE "enterprise_programs" DROP CONSTRAINT IF EXISTS "FK_enterprise_programs_customer"');
    await queryRunner.query('DROP TABLE IF EXISTS "enterprise_warehouses"');
    await queryRunner.query('DROP TABLE IF EXISTS "enterprise_programs"');
    await queryRunner.query('DROP TABLE IF EXISTS "enterprise_customers"');
    await queryRunner.query('DROP TABLE IF EXISTS "enterprise_buildings"');
  }
}
